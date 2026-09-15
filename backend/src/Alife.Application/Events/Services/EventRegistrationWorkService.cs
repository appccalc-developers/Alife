using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public sealed partial class EventRegistrationWorkService(IAlifeDbContext db, IEventPackageInvalidationService invalidation, IEventPackageService? packages = null)
{
    internal static readonly JsonSerializerOptions Json = EventCompositionEngine.CreateJsonOptions();
    public static string PolicyETag(EventRegistrationPolicy? p) => p is null ? "\"registration-new\"" : $"\"registration-{p.ConcurrencyToken:N}\"";
    public static string ApplicationETag(EventRegistrationApplication a) => $"\"application-{a.ConcurrencyToken:N}\"";
    public static RegistrationRules Rules(EventRegistrationPolicy p) => JsonSerializer.Deserialize<RegistrationRules>(p.RulesJson, Json)!;
    private Task<bool> Manager(GroupEvent e, Guid actor, CancellationToken ct) => Manage(e, actor, "PEOPLE.REGISTRATION", "registration.manager", ct);
    private async Task<bool> Manage(GroupEvent e, Guid actor, string module, string role, CancellationToken ct)
        => await EventWorkAccess.OwnerAsync(db, e, actor, ct) || await EventWorkAccess.RoleAsync(db, e, actor, module, role, ct);
    private Task<bool> Finance(GroupEvent e, Guid actor, CancellationToken ct) => EventWorkAccess.RoleAsync(db, e, actor, "MONEY.FINANCE", "finance.owner", ct);
    private Task<bool> FeeApprover(GroupEvent e, Guid actor, CancellationToken ct) => EventWorkAccess.RoleAsync(db, e, actor, "MONEY.FINANCE", "finance.approver", ct);

    public async Task<bool> ApprovedAsync(GroupEvent e, CancellationToken ct)
    {
        return packages is not null && await packages.IsRegistrationApprovalCurrentAsync(e.Id, ct);
    }
    private async Task<bool> VisibleAsync(GroupEvent e, Guid actor, CancellationToken ct)
    {
        if (e.PublicationStatus is not (EventPublicationStatus.Published or EventPublicationStatus.LegacyImplicit)) return false;
        var visibility = EventVisibilityPolicy.ReadVisibility(e.EventDataJson);
        if (visibility == "public") return true;
        if (await EventWorkAccess.MemberAsync(db, e.GroupId, actor, ct)) return true;
        var root = await EventCompositionPersistence.FindChurchRootIdAsync(db, e.GroupId, ct);
        return visibility == "churchVisible" && root.HasValue && await EventWorkAccess.MemberAsync(db, root.Value, actor, ct);
    }
    private async Task<bool> Eligible(RegistrationRules rules, GroupEvent e, Guid? member, bool invited, CancellationToken ct)
    {
        if (rules.Audience == "invited") return invited;
        if (rules.Audience == "public") return !member.HasValue || await VisibleAsync(e, member.Value, ct) || invited;
        if (!member.HasValue) return false;
        if (rules.Audience == "group") return await EventWorkAccess.MemberAsync(db, rules.EligibleGroupId ?? e.GroupId, member.Value, ct);
        var root = await EventCompositionPersistence.FindChurchRootIdAsync(db, e.GroupId, ct);
        return root.HasValue && await EventWorkAccess.MemberAsync(db, root.Value, member.Value, ct);
    }
    public async Task<AppResult<RegistrationWorkDto>> GetAsync(Guid eventId, Guid actor, int page, string? search, CancellationToken ct, Guid? applicationId = null)
    {
        var e = await db.GroupEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (e is null) return AppResult<RegistrationWorkDto>.NotFound("Event not found.");
        var owner = await EventWorkAccess.OwnerAsync(db, e, actor, ct); var manager = await Manager(e, actor, ct);
        var finance = await Finance(e, actor, ct); var approver = await FeeApprover(e, actor, ct);
        var own = await db.EventRegistrationApplications.AsNoTracking().AnyAsync(x => x.EventId == eventId &&
            (x.OrganiserMemberId == actor && (!x.IsInvitation || x.InvitedUtc != null) || x.Participants.Any(p => p.MemberId == actor || p.GuardianMemberId == actor) && (!x.IsInvitation || x.InvitedUtc != null)), ct);
        if (!manager && !finance && !approver && !own && !await VisibleAsync(e, actor, ct)) return AppResult<RegistrationWorkDto>.Forbidden("Registration is not visible to this account.");
        var policy = await db.EventRegistrationPolicies.AsNoTracking().FirstOrDefaultAsync(x => x.EventId == eventId, ct);
        var approved = await ApprovedAsync(e, ct); var now = DateTime.UtcNow;
        var rows = db.EventRegistrationApplications.AsNoTracking().Include(x => x.Participants).Where(x => x.EventId == eventId);
        if (!manager && !finance) rows = rows.Where(x => (x.OrganiserMemberId == actor && (!x.IsInvitation || x.InvitedUtc != null)) || (!x.IsInvitation || x.InvitedUtc != null) && x.Participants.Any(p => p.MemberId == actor || p.GuardianMemberId == actor));
        if (!string.IsNullOrWhiteSpace(search)) rows = rows.Where(x => x.Participants.Any(p => p.DisplayName.Contains(search)));
        if (applicationId.HasValue) rows = rows.Where(x => x.Id == applicationId.Value);
        page = Math.Max(1, page);
        var applications = await rows.OrderBy(x => x.QueuedUtc).ThenBy(x => x.Id).Skip((page - 1) * 20).Take(21).ToArrayAsync(ct);
        var all = await db.EventRegistrationParticipants.AsNoTracking().Where(x => x.Application.EventId == eventId).Select(x => new { x.SeatStatus, x.Application.ReservationExpiresUtc }).ToArrayAsync(ct);
        var rules = policy is null ? null : Rules(policy);
        return AppResult<RegistrationWorkDto>.Success(new(e.Id, new(e.TitleEn, e.TitleZh), policy is null ? null : new(policy.Version, rules!, PolicyETag(policy), policy.FeeApprovalStatus),
            owner && !await EventPreparationPolicy.IsFrozenAsync(db, eventId, ct), manager, finance, approver, approved,
            approved && rules is not null && rules.OpensUtc <= now && rules.DeadlineUtc >= now && e.RegistrationStatus == EventRegistrationStatus.Open && await VisibleAsync(e, actor, ct),
            all.Count(x => x.SeatStatus == "confirmed"), all.Count(x => x.SeatStatus == "reserved" && x.ReservationExpiresUtc > now), all.Count(x => x.SeatStatus == "waitlisted"),
            applications.Take(20).Select(a => ToDto(a, actor, manager || finance, finance && !manager)).ToArray(), page, applications.Length > 20, e.GroupId, e.StartDate, e.EndDate));
    }
    private static RegistrationApplicationDto ToDto(EventRegistrationApplication a, Guid actor, bool manager, bool financeOnly = false)
        => new(a.Id, a.OrganiserMemberId, a.AllowSplit, a.IsInvitation, a.InvitationMode, a.InvitedUtc, a.ReservationExpiresUtc, ApplicationETag(a), a.Channel, a.PolicyVersion,
            a.Participants.Where(p => manager || a.OrganiserMemberId == actor && !p.ProxyAccessRevoked || p.MemberId == actor || p.IsChild && p.GuardianMemberId == actor).Select(p => new RegistrationParticipantDto(p.Id, p.MemberId, p.DisplayName, p.IsChild, financeOnly ? "" : p.GuardianName,
                p.SeatStatus, p.ProcedureStatus, financeOnly ? "" : p.ConsentMethod, financeOnly ? null : p.ConsentedUtc, !financeOnly && p.EligibilityVerified, !financeOnly && p.MaterialsVerified, financeOnly ? "{}" : p.AnswersJson, p.PaidMinor, p.RefundedMinor, p.IsLegacy, financeOnly ? null : p.GuardianMemberId, p.ProxyAccessRevoked)).ToArray(), a.CreatedByMemberId, a.ManualOrganiserName);

    public async Task<AppResult<RegistrationPolicyDto>> SaveRulesAsync(Guid eventId, Guid actor, RegistrationRules rules, string? expected, CancellationToken ct)
    {
        var error = ValidateRules(rules); if (error is not null) return AppResult<RegistrationPolicyDto>.Validation(error);
        await using var tx = await db.BeginSerializableTransactionAsync(ct); await db.LockEventRegistrationAsync(eventId, ct);
        var e = await db.GroupEvents.FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (e is null) return AppResult<RegistrationPolicyDto>.NotFound("Event not found.");
        if (!await EventWorkAccess.OwnerAsync(db, e, actor, ct)) return AppResult<RegistrationPolicyDto>.Forbidden("Only the accountable owner configures registration.");
        if (await EventPreparationPolicy.IsFrozenAsync(db, eventId, ct)) return AppResult<RegistrationPolicyDto>.Conflict(EventPreparationPolicy.FrozenMessage);
        if (e.EventSeriesId is null && rules.DeadlineUtc > e.EndDate) return AppResult<RegistrationPolicyDto>.Validation("Registration must close before the Event ends.");
        if (rules.EligibleGroupId.HasValue)
        {
            var root = await EventCompositionPersistence.FindChurchRootIdAsync(db, e.GroupId, ct);
            if (rules.EligibleGroupId != e.GroupId && (!root.HasValue || root != await EventCompositionPersistence.FindChurchRootIdAsync(db, rules.EligibleGroupId.Value, ct))) return AppResult<RegistrationPolicyDto>.Forbidden("Eligibility group must belong to this church.");
        }
        var policy = await db.EventRegistrationPolicies.FirstOrDefaultAsync(x => x.EventId == eventId, ct);
        if (expected != PolicyETag(policy)) return AppResult<RegistrationPolicyDto>.PreconditionFailed("Registration rules changed.");
        var applications = await db.EventRegistrationApplications.Include(x => x.Participants).Where(x => x.EventId == eventId).ToListAsync(ct);
        var occupied = applications.SelectMany(x => x.Participants).Count(x => x.SeatStatus == "confirmed" || x.SeatStatus == "reserved" && x.Application.ReservationExpiresUtc > DateTime.UtcNow);
        if (policy is null) occupied += await db.EventEnrollments.CountAsync(x => x.EventId == eventId && x.Status == "confirmed", ct);
        if (rules.Capacity < occupied) return AppResult<RegistrationPolicyDto>.Conflict("Capacity cannot be below confirmed and reserved participants.");
        if (policy is null)
        {
            policy = new() { EventId = eventId }; db.EventRegistrationPolicies.Add(policy);
            // Only the existing account/seat is proven. Never infer family members or consent from legacy JSON.
            var legacy = await db.EventEnrollments.Where(x => x.EventId == eventId).ToArrayAsync(ct);
            foreach (var row in legacy)
            {
                var name = await db.Members.Where(x => x.Id == row.MemberId).Select(x => x.DisplayName).FirstOrDefaultAsync(ct) ?? "Member";
                var application = new EventRegistrationApplication { Id = Guid.NewGuid(), EventId = eventId, OrganiserMemberId = row.MemberId, CreatedByMemberId = row.MemberId, LegacyEnrollmentId = row.Id, QueuedUtc = row.QueuedUtc ?? row.CreatedUtc, PolicyVersion = 0, Channel = "legacy" };
                application.Participants.Add(new() { Id = Guid.NewGuid(), MemberId = row.MemberId, DisplayName = name, SeatStatus = row.Status, ProcedureStatus = "legacy", IsLegacy = true, AnswersJson = row.EnrollmentJson });
                db.EventRegistrationApplications.Add(application);
            }
        }
        if (!await EventWorkAccess.EnabledAsync(db, eventId, "PEOPLE.REGISTRATION", ct) || rules.FeeMinor > 0 && !await EventWorkAccess.EnabledAsync(db, eventId, "MONEY.FINANCE", ct))
            return AppResult<RegistrationPolicyDto>.Conflict("Enable registration and, for fees, finance in the accepted plan first.");
        e.CollaborationVersion = 1;
        policy.Version++; policy.RulesJson = JsonSerializer.Serialize(rules, Json); policy.UpdatedUtc = DateTime.UtcNow; policy.ConcurrencyToken = Guid.NewGuid();
        policy.FeeApprovalStatus = rules.FeeMinor > 0 ? "notSubmitted" : "notRequired"; policy.FeeApprovedByMemberId = null; policy.FeeSubmittedByMemberId = null;
        var data = JsonNode.Parse(e.EventDataJson)?.AsObject() ?? new JsonObject();
        data["maxCapacity"] = rules.Capacity; data["registrationDeadline"] = rules.DeadlineUtc.ToString("O"); data["registrationRulesVersion"] = policy.Version; e.EventDataJson = data.ToJsonString();
        Audit(e.Id, actor, "rules.saved", policy.RulesJson);
        await invalidation.InvalidateForModuleChangeAsync(e, actor, "PEOPLE.REGISTRATION", "event.registration.rulesChanged", "operational", ct);
        await db.SaveChangesAsync(ct); if (tx is not null) await tx.CommitAsync(ct);
        return AppResult<RegistrationPolicyDto>.Success(new(policy.Version, rules, PolicyETag(policy), policy.FeeApprovalStatus));
    }
    private static string? ValidateRules(RegistrationRules r)
    {
        static bool Text(LocalizedTextDto? t) => t is not null && (!string.IsNullOrWhiteSpace(t.En) || !string.IsNullOrWhiteSpace(t.Zh)) && (t.En?.Length ?? 0) <= 10000 && (t.Zh?.Length ?? 0) <= 10000;
        if (!Text(r.Purpose) || !Text(r.Terms) || !Text(r.PrivacyNotice) || !Text(r.CancellationTerms)) return "Purpose, participation rules, privacy and cancellation terms are required. / 请填写报名目的、参加规则、隐私与取消说明。";
        if (r.Audience is not ("invited" or "group" or "church" or "public") || r.Channel is not ("app" or "manual" or "both")) return "Choose valid eligibility and channels.";
        if (r.Capacity is < 1 or > 1000000 || r.OpensUtc.Kind != DateTimeKind.Utc || r.DeadlineUtc.Kind != DateTimeKind.Utc || r.OpensUtc >= r.DeadlineUtc) return "Valid capacity and UTC opening/deadline are required.";
        if (r.FeeMinor < 0 || r.FeeMinor > 100000000 || r.Currency is null || r.Currency.Length != 3 || !r.Currency.All(char.IsAsciiLetterUpper) || r.MoneyFlowScope is not ("unspecified" or "registrationFeesOnly" or "otherMoney")) return "Use non-negative minor-unit fees, a three-letter currency and an explicit money-flow scope.";
        if (r.FeeMinor > 0 && (!Text(r.PaymentInstructions) || !Text(r.RefundTerms))) return "Payment instructions and refund terms are required.";
        if (r.Materials is null || r.Materials.Count > 20 || r.Materials.Select(x => x.Id).Distinct().Count() != r.Materials.Count || r.Materials.Any(x => string.IsNullOrWhiteSpace(x.Id) || x.Id.Length > 80 || !Text(x.Label) || x.Kind is not ("text" or "image" or "file") || x.MaxCount is < 1 or > 10 || x.MaxBytes is < 1 or > 20971520)) return "Check material labels, types, counts and file limits (maximum 20 MB).";
        return null;
    }
    private void Audit(Guid eventId, Guid actor, string operation, string snapshot, Guid? application = null, Guid? participant = null, string? evidence = null)
        => db.EventRegistrationActions.Add(new() { Id = Guid.NewGuid(), EventId = eventId, ActorMemberId = actor, Operation = operation, SnapshotJson = snapshot, ApplicationId = application, ParticipantId = participant, Evidence = evidence ?? "", CreatedUtc = DateTime.UtcNow });
    private void Notice(GroupEvent e, Guid recipient, Guid actor, string operation, Guid application)
    {
        var now = DateTime.UtcNow;
        db.NotificationMessages.Add(new() { Id = Guid.NewGuid(), RecipientMemberId = recipient, CreatedByMemberId = actor, EventId = e.Id, GroupId = e.GroupId, ActionType = operation,
            ActionDataJson = JsonSerializer.Serialize(new { title = new LocalizedTextDto("Registration update", "报名事务更新"), eventTitle = new LocalizedTextDto(e.TitleEn, e.TitleZh), actionUrl = $"/events/{e.Id}/registration-work?application={application}" }, Json), OccurredUtc = now, CreatedUtc = now, UpdatedUtc = now });
    }
    private async Task<AppResult<Guid>?> Replay(Guid eventId, Guid actor, string operation, object input, string? key, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(key) || key.Length > 200) return AppResult<Guid>.Validation("Idempotency-Key is required.");
        var op = $"registration.{operation}.{actor:N}";
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(input, Json))));
        var previous = await db.EventIdempotencyRecords.AsNoTracking().FirstOrDefaultAsync(x => x.Operation == op && x.ScopeId == eventId && x.Key == key, ct);
        if (previous is not null) return previous.RequestHash == hash ? AppResult<Guid>.Success(previous.ResultEntityId) : AppResult<Guid>.Conflict("Idempotency-Key reused for different content.");
        return null;
    }
    private void Remember(Guid eventId, Guid actor, string operation, object input, string key, Guid id)
        => db.EventIdempotencyRecords.Add(new() { Id = Guid.NewGuid(), ScopeId = eventId, Operation = $"registration.{operation}.{actor:N}", Key = key, RequestHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(input, Json)))), ResultEntityId = id, CreatedUtc = DateTime.UtcNow, ExpiresUtc = DateTime.UtcNow.AddDays(1) });

    public async Task<AppResult<Guid>> CreateAsync(Guid eventId, Guid actor, RegistrationApplicationRequest input, string? key, CancellationToken ct)
    {
        if (input.Participants is null || input.Participants.Count is < 1 or > 30 || input.Participants.Any(x => x is null || string.IsNullOrWhiteSpace(x.DisplayName) || x.DisplayName.Length > 200 || (x.GuardianName?.Length ?? 0) > 200 || x.IsChild && string.IsNullOrWhiteSpace(x.GuardianName))) return AppResult<Guid>.Validation("Enter 1–30 participants with names and explicit guardians for children.");
        if (input.InvitationMode is not ("now" or "byDeadline") || input.Channel is not ("app" or "manual")) return AppResult<Guid>.Validation("Invalid invitation mode or channel.");
        if ((input.ManualOrganiserName?.Length ?? 0) > 200 || (input.ProxyAuthorityEvidence?.Length ?? 0) > 2000 || input.Channel == "manual" && string.IsNullOrWhiteSpace(input.ManualOrganiserName))
            return AppResult<Guid>.Validation("Record the actual offline organiser name for manual entry.");
        if (!input.IsInvitation && input.Participants.Any(p => p.MemberId != actor) && string.IsNullOrWhiteSpace(input.ProxyAuthorityEvidence))
            return AppResult<Guid>.Validation("Explicitly record the authority to enter information for other participants. It does not provide their participation consent.");
        await using var tx = await db.BeginSerializableTransactionAsync(ct); await db.LockEventRegistrationAsync(eventId, ct);
        var e = await db.GroupEvents.FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (e is null) return AppResult<Guid>.NotFound("Event not found.");
        var manager = await Manager(e, actor, ct);
        if (input.IsInvitation && !manager || input.OrganiserMemberId != actor && !manager || input.Channel == "manual" && !manager) return AppResult<Guid>.Forbidden("Registration manager permission is required.");
        if (!manager && !await VisibleAsync(e, actor, ct)) return AppResult<Guid>.Forbidden("Event is not open to this account.");
        if (!await db.Members.AnyAsync(x => x.Id == input.OrganiserMemberId, ct)) return AppResult<Guid>.Validation("The organiser needs an existing account.");
        if (input.AllowSplit && input.OrganiserMemberId != actor) return AppResult<Guid>.Forbidden("Only the organiser can explicitly choose partial household confirmation.");
        var accountIds = input.Participants.SelectMany(p => new[] { p.MemberId, p.GuardianMemberId }).Where(id => id.HasValue).Select(id => id!.Value).Distinct().ToArray();
        if (await db.Members.CountAsync(x => accountIds.Contains(x.Id), ct) != accountIds.Length)
            return AppResult<Guid>.Validation("Every selected participant and guardian account must exist.");
        if (!await EventWorkAccess.EnabledAsync(db, eventId, "PEOPLE.REGISTRATION", ct)) return AppResult<Guid>.Conflict("Registration is disabled for this event.");
        var replay = await Replay(eventId, actor, "create", input, key, ct); if (replay is not null) return replay;
        var policy = await db.EventRegistrationPolicies.FirstOrDefaultAsync(x => x.EventId == eventId, ct);
        if (policy is null) return AppResult<Guid>.Conflict("Configure registration rules first.");
        var rules = Rules(policy); var now = DateTime.UtcNow;
        if (!input.IsInvitation && (!await ApprovedAsync(e, ct) || e.RegistrationStatus != EventRegistrationStatus.Open || now < rules.OpensUtc || now > rules.DeadlineUtc)) return AppResult<Guid>.Conflict("Registration is not open.");
        if (rules.Channel != "both" && input.Channel != rules.Channel) return AppResult<Guid>.Conflict("This registration channel is not enabled.");
        if (!input.IsInvitation && rules.Audience == "invited") return AppResult<Guid>.Forbidden("Only named invitations are accepted.");
        var identities = input.Participants.Where(x => x.MemberId.HasValue).Select(x => x.MemberId!.Value).ToArray();
        if (identities.Distinct().Count() != identities.Length || await db.EventRegistrationParticipants.AnyAsync(x => x.Application.EventId == eventId && x.MemberId.HasValue && identities.Contains(x.MemberId.Value) && x.SeatStatus != "cancelled" && x.SeatStatus != "expired", ct)) return AppResult<Guid>.Conflict("A named participant is already registered or invited.");
        foreach (var person in input.Participants)
            if (!input.IsInvitation && !await Eligible(rules, e, person.MemberId, false, ct)) return AppResult<Guid>.Forbidden("A participant does not meet the selected eligibility scope.");
        var application = new EventRegistrationApplication { Id = Guid.NewGuid(), EventId = eventId, OrganiserMemberId = input.OrganiserMemberId, CreatedByMemberId = actor,
            ManualOrganiserName = input.ManualOrganiserName?.Trim() ?? "", ProxyAuthorityEvidence = input.ProxyAuthorityEvidence?.Trim() ?? "",
            AllowSplit = input.AllowSplit, IsInvitation = input.IsInvitation, InvitationMode = input.InvitationMode, ReservationExpiresUtc = input.ReservationExpiresUtc ?? rules.DeadlineUtc,
            PolicyVersion = policy.Version, Channel = input.Channel, QueuedUtc = now };
        if (application.ReservationExpiresUtc > rules.DeadlineUtc || application.ReservationExpiresUtc <= now || application.ReservationExpiresUtc?.Kind != DateTimeKind.Utc) return AppResult<Guid>.Validation("Reservation expiry must be a future UTC time no later than registration deadline.");
        foreach (var p in input.Participants) application.Participants.Add(new() { Id = Guid.NewGuid(), MemberId = p.MemberId, DisplayName = p.DisplayName.Trim(), IsChild = p.IsChild, GuardianName = p.GuardianName?.Trim() ?? "", GuardianMemberId = p.IsChild ? p.GuardianMemberId : null });
        db.EventRegistrationApplications.Add(application);
        Audit(eventId, actor, "application.created", JsonSerializer.Serialize(input, Json), application.Id);
        Remember(eventId, actor, "create", input, key!, application.Id);
        await db.SaveChangesAsync(ct); if (tx is not null) await tx.CommitAsync(ct);
        return AppResult<Guid>.Success(application.Id);
    }
}
