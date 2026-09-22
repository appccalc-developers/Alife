using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Alife.Application.Events.Services;

public sealed record EventWorkLink(string Key, string Stage, LocalizedTextDto Title, string Url, bool CanEdit);
public sealed record EventWorkOccurrence(Guid Id, DateTime StartUtc, DateTime EndUtc, string Stage, string Status);
public sealed record EventWorkSummary(Guid EventId, Guid GroupId, LocalizedTextDto Title, DateTime StartUtc, DateTime EndUtc,
    string? PosterImageUrl, string Stage, bool CanManage, string[] Roles);
public sealed record EventWorkPage(EventWorkSummary Event, IReadOnlyList<EventWorkLink> Links, IReadOnlyList<EventWorkOccurrence> Occurrences,
    int OccurrencePage, bool HasMoreOccurrences, IReadOnlyList<EventDuty> Duties, EventPlanSnapshotDto? Plan, IReadOnlyList<EventReportRevisionDto> Reports,
    RamEventPlanContextDto? PlanContext = null, ReadinessDto? PreparationProgress = null);
public sealed record EventWorkList(IReadOnlyList<EventWorkSummary> Items, int Page, bool HasMore);

public sealed class EventWorkService(IAlifeDbContext db, EventDutyProjectionService duties)
{
    private static string? PosterImageUrl(Alife.Domain.Entities.GroupEvent item)
    {
        try
        {
            using var document = JsonDocument.Parse(item.EventDataJson);
            if (document.RootElement.ValueKind != JsonValueKind.Object ||
                !document.RootElement.TryGetProperty("posterImageUrl", out var value) ||
                value.ValueKind != JsonValueKind.String) return null;
            var url = value.GetString()?.Trim();
            return string.IsNullOrWhiteSpace(url) ? null : url;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    private static string Stage(DateTime start, DateTime end, bool published, bool recurring)
        => !published ? "preparation" : start <= DateTime.UtcNow && end > DateTime.UtcNow ? "execution" : end <= DateTime.UtcNow && !recurring ? "followup" : "registration";
    private async Task<string> StageAsync(Alife.Domain.Entities.GroupEvent e, CancellationToken ct)
    {
        var published = e.PublicationStatus is EventPublicationStatus.Published or EventPublicationStatus.LegacyImplicit;
        if (published && e.EventSeriesId.HasValue && await db.EventOccurrences.AnyAsync(x => x.EventId == e.Id && x.StartUtc <= DateTime.UtcNow && x.EndUtc > DateTime.UtcNow && x.Status != EventOccurrenceStatus.Cancelled,ct)) return "execution";
        return Stage(e.StartDate,e.EndDate,published,e.EventSeriesId.HasValue);
    }
    public async Task<AppResult<EventWorkPage>> GetAsync(Guid id, Guid actor, int page, CancellationToken ct)
    {
        var e = await db.GroupEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == id, ct);
        if (e is null) return AppResult<EventWorkPage>.NotFound("Event not found.");
        var roles = await EventWorkAccess.RolesAsync(db, e, actor, ct);
        var owner = await EventWorkAccess.OwnerAsync(db, e, actor, ct);
        var reader = await EventWorkAccess.PlanReaderAsync(db, e, actor, ct);
        var myDuties = await duties.ListAsync(actor, ct, id);
        var roster = await EventWorkAccess.MemberAsync(db, e.GroupId, actor, ct) && await db.EventRosterAssignments.AsNoTracking().AnyAsync(x => x.ServiceSlot.Occurrence.EventId == id && x.MemberId == actor && x.EndedUtc == null, ct);
        var enrollment = await db.EventEnrollments.AsNoTracking().AnyAsync(x => x.EventId == id && x.MemberId == actor, ct);
        enrollment = enrollment || await db.EventRegistrationApplications.AnyAsync(x => x.EventId == id && (!x.IsInvitation || x.InvitedUtc != null) &&
            (x.OrganiserMemberId == actor || x.Participants.Any(p => p.MemberId == actor || p.IsChild && p.GuardianMemberId == actor)), ct);
        if (!reader && !roster && !enrollment && myDuties.Count == 0) return AppResult<EventWorkPage>.Forbidden("No current Event responsibility. / 当前没有此活动的工作权限。");
        var summary = new EventWorkSummary(id, e.GroupId, new(e.TitleEn, e.TitleZh), e.StartDate, e.EndDate,
            PosterImageUrl(e), await StageAsync(e,ct), owner, roles);
        var published = e.PublicationStatus is EventPublicationStatus.Published or EventPublicationStatus.LegacyImplicit;
        var links = new List<EventWorkLink>();
        void Add(string key, string stage, string en, string zh, string url, bool edit) => links.Add(new(key, stage, new(en, zh), url, edit));
        var root = $"/events/{id}";
        if (owner) Add("preparation", "preparation", "Prepare event plan", "筹备活动方案", root + "/workspace?flow=setup&stage=arrangements", true);
        if (published && reader) Add("published-event", "registration", "Published event", "已公布的活动", $"/groups/{e.GroupId}/events/{id}", false);
        if (reader) Add("plan", "preparation", "Read full event plan", "查看完整活动方案", root + "/work?stage=preparation&plan=1", false);
        if (owner || roles.Length > 0 || myDuties.Any(x => x.Surface == "task"))
            foreach (var stage in new[] { "preparation", "registration", "execution", "followup" })
                Add("tasks:" + stage, stage, "Tasks and handoffs", "任务与交接", root + "/workspace?tab=team&taskStage=" + stage, owner);
        foreach (var pair in EventWorkAccess.ReportRoles)
            if ((owner || EventWorkAccess.HasRole(roles, pair.Key, pair.Value)) && await EventWorkAccess.EnabledAsync(db,id,pair.Key,ct))
            {
                var module = EventCompositionDefinitions.ModulesByCode[pair.Key];
                Add("report:" + pair.Key, "preparation", module.Name.En + " report", module.Name.Zh + "报告", root + "/reports/" + pair.Key, EventWorkAccess.HasRole(roles, pair.Key, pair.Value));
            }
        if (owner || roles.Any(EventDutyAccess.IsRamAuthorRole) || await EventWorkAccess.ReviewContextAsync(db, e, actor, ct)) Add("ram", "preparation", "RAM workspace", "RAM 工作空间", root + "/workspace/ram", e.CollaborationVersion == 0 && owner || roles.Any(EventDutyAccess.IsRamAuthorRole));
        if (owner || EventWorkAccess.HasRole(roles, "PEOPLE.REGISTRATION", "registration.manager")) {
            Add("registration:prepare", "preparation", "Prepare registration and invitations", "筹办报名与邀请", root + "/registration-work", true);
            Add("registration", "registration", "Manage registration", "报名办理", root + "/registration-work", true);
        }
        if (enrollment) Add("participation", "registration", "My participation", "我的报名手续", root + "/registration-work", false);
        if (EventWorkAccess.HasRole(roles,"MONEY.FINANCE","finance.owner") || EventWorkAccess.HasRole(roles,"MONEY.FINANCE","finance.approver")) {
            Add("fees:prepare","preparation","Registration fee approval","报名费审批",root+"/registration-work",true);
            Add("fees","registration","Registration fee work","报名费办理",root+"/registration-work",true);
            Add("fees:followup","followup","Registration refunds and reconciliation","报名退款与核对",root+"/registration-work",true);
        }
        if (owner) Add("venues","preparation","Venue and room calendar","场地与房间日历",$"/groups/{e.GroupId}/venues?event={id}",true);
        var coordinatesRoster = EventWorkAccess.HasRole(roles, "SERVICE.ROSTER", "roster.coordinator") || e.CollaborationVersion == 0 && owner;
        if (published && await EventWorkAccess.EnabledAsync(db,id,"SERVICE.ROSTER",ct) && coordinatesRoster) {
            Add("roster:published", "registration", "Schedule volunteers across dates", "多场次手工排班", root + "/workspace/roster", true);
            Add("roster", "execution", "Schedule volunteers across dates", "多场次手工排班", root + "/workspace/roster", true);
        } else if (published && roster) {
            Add("my-roster", "registration", "My service assignment", "我的服事安排", root + "/workspace/roster", false);
        }
        foreach (var item in new[] { ("SAFEGUARDING.CHILD", "safeguarding.lead", "safeguarding", "Child safeguarding", "儿童保护执行"), ("MOVE.STAY", "travel.coordinator", "travel", "Transport and stay", "交通与住宿执行"), ("PROGRAM.PRODUCTION", "programme.lead", "?tab=programme", "Programme delivery", "节目执行") })
            if (owner || EventWorkAccess.HasRole(roles, item.Item1, item.Item2)) Add(item.Item3, "execution", item.Item4, item.Item5, root + "/workspace" + (item.Item3.StartsWith('?') ? item.Item3 : "/" + item.Item3), true);
        page = Math.Max(1, page);
        var occurrenceRows = await db.EventOccurrences.AsNoTracking().Where(x => x.EventId == id).OrderBy(x => x.StartUtc).Skip((page - 1) * 12).Take(13).ToArrayAsync(ct);
        var occurrences = occurrenceRows.Take(12).Select(x => new EventWorkOccurrence(x.Id, x.StartUtc, x.EndUtc,
            x.EndUtc <= DateTime.UtcNow ? "followup" : x.StartUtc <= DateTime.UtcNow ? "execution" : "preparation", x.Status.ToString())).ToArray();
        var planRow = reader ? await db.EventPlanSnapshots.AsNoTracking().Where(x => x.EventId == id && x.IsActive).OrderByDescending(x => x.Version).FirstOrDefaultAsync(ct) : null;
        EventPlanSnapshotDto? plan = null;
        if (planRow is not null) { try { plan = EventCompositionPersistence.ToSnapshotDto(planRow); } catch (System.Text.Json.JsonException) { return AppResult<EventWorkPage>.Conflict("Stored plan cannot be read."); } }
        var adopted = reader ? await db.EventModuleReportRevisions.AsNoTracking().Where(x => x.Report.EventId == id && x.Report.AdoptedRevisionId == x.Id)
            .Select(x => new EventReportRevisionDto(x.Id, x.Version, new(x.TextEn, x.TextZh), x.AuthorMemberId, x.EventPlanVersion, x.SubmittedUtc)).ToArrayAsync(ct) : [];
        var progress = owner && plan is not null ? (await EventCompositionPersistence.ApplyOperationalReadinessAsync(db,
            EventCompositionPersistence.RefreshReadiness(plan.Plan,e,DateTime.UtcNow),e,DateTime.UtcNow,ct,rosterRulesVersion:2)).Readiness : null;
        return AppResult<EventWorkPage>.Success(new(summary, links, occurrences, page, occurrenceRows.Length > 12, myDuties, plan, adopted,
            reader ? await EventPlanContextCapture.CaptureAsync(db,e,ct) : null, progress));
    }

    public async Task<EventWorkList> ListAsync(Guid actor, int page, string? search, CancellationToken ct)
    {
        page = Math.Max(1, page);
        var groups = await db.GroupMemberships.AsNoTracking().Where(x => x.MemberId == actor && x.Status == MembershipStatus.Approved).Select(x => x.GroupId).ToArrayAsync(ct);
        var dutyEvents = (await duties.ListAsync(actor,ct)).Where(x => x.Task.EventId.HasValue).Select(x => x.Task.EventId!.Value).Distinct().ToList();
        var reviewed = await db.GroupEvents.AsNoTracking().Where(e => db.EventRamActions.Any(x => x.EventId == e.Id && x.ActorMemberId == actor && (x.Action == "approve" || x.Action == "return"))).ToArrayAsync(ct);
        foreach (var e in reviewed) if (await EventWorkAccess.ReviewContextAsync(db,e,actor,ct)) dutyEvents.Add(e.Id);
        var query = db.GroupEvents.AsNoTracking().Where(e =>
            dutyEvents.Contains(e.Id) ||
            groups.Contains(e.GroupId) && (e.AccountableOwnerMemberId == actor || e.AccountableOwnerMemberId == Guid.Empty && e.CreatedByMemberId == actor ||
                db.EventRoleAssignments.Any(x => x.EventId == e.Id && x.MemberId == actor && x.Status == EventRoleAssignmentStatus.Accepted && x.EndedUtc == null) ||
                db.EventTeamMembers.Any(x => x.EventId == e.Id && x.MemberId == actor && x.Status == EventTeamMemberStatus.Accepted && x.EndedUtc == null) ||
                db.EventRosterAssignments.Any(x => x.ServiceSlot.Occurrence.EventId == e.Id && x.MemberId == actor && x.EndedUtc == null)) ||
            db.EventEnrollments.Any(x => x.EventId == e.Id && x.MemberId == actor) ||
            db.EventRegistrationApplications.Any(x => x.EventId == e.Id && (!x.IsInvitation || x.InvitedUtc != null) &&
                (x.OrganiserMemberId == actor || x.Participants.Any(p => p.MemberId == actor || p.IsChild && p.GuardianMemberId == actor))));
        if (!string.IsNullOrWhiteSpace(search)) query = query.Where(x => x.TitleEn.Contains(search) || x.TitleZh.Contains(search));
        var rows = await query.OrderByDescending(x => x.UpdatedUtc).ThenBy(x => x.Id).Skip((page - 1) * 20).Take(21).ToArrayAsync(ct);
        var items = new List<EventWorkSummary>();
        foreach (var e in rows.Take(20)) items.Add(new(e.Id, e.GroupId, new(e.TitleEn, e.TitleZh), e.StartDate, e.EndDate,
            PosterImageUrl(e), await StageAsync(e,ct), await EventWorkAccess.OwnerAsync(db, e, actor, ct), await EventWorkAccess.RolesAsync(db, e, actor, ct)));
        return new(items, page, rows.Length > 20);
    }
}
