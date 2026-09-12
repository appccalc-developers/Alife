using System.Text.Json;
using Alife.Application.Admin;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public sealed class EventRamGovernanceService(IAlifeDbContext db, IGroupAuthorizationService authorization,
    IEventCacheInvalidationService cache, IEventPackageInvalidationService packages)
{
    public const string UpgradeMessage = "ram.client.upgradeRequired: Open the current RAM editor; versioned RAM cannot be submitted or overwritten by a legacy client. / 请打开新版 RAM 编辑器。";
    private static string Hash<T>(T value) where T : notnull => EventPackageCanonicalizer.HashCanonical(value);
    private static string Token(EventRamAssessment? ram) => ram?.ConcurrencyToken.ToString("D") ?? "new";
    private static bool Matches(string? expected, string actual) => expected?.Trim('"') == actual;
    private static RamPolicyDto PolicyDto(EventRamPolicyVersion p) => new(p.Id,p.ChurchId,p.Version,p.IsPublished,p.ConcurrencyToken.ToString("D"),
        JsonSerializer.Deserialize<RamPolicyData>(p.PolicyJson,RamEvaluator.Json)!,p.PublishedByMemberId,p.PublishedUtc);
    private static RamRevisionDto RevisionDto(EventRamRevision r) => new(r.Id,r.Version,r.SchemaVersion,r.PolicyVersionId,r.ContentHash,r.ResidualLevel,r.AuthorMemberId,r.OnsiteMemberId,r.CreatedUtc);
    private static RamActionDto ActionDto(EventRamAction a) => new(a.Id,a.RevisionId,a.ActorMemberId,a.Action,a.Reason,a.HealthSafetySigned,a.CreatedUtc);
    private Task<bool> ChurchMember(Guid church, Guid actor, CancellationToken ct) => db.GroupMemberships.AsNoTracking()
        .AnyAsync(x => x.GroupId == church && x.MemberId == actor && x.Status == MembershipStatus.Approved,ct);

    public async Task<bool> CanAuditAsync(GroupEvent e, Guid actor, CancellationToken ct)
    {
        var church = await EventCompositionPersistence.FindChurchRootIdAsync(db,e.GroupId,ct);
        return church.HasValue && await ChurchMember(church.Value,actor,ct) &&
            await AdminPlatformRoleHelpers.HasPermissionAsync(db,actor,AdminPermissionCatalog.AuditEvents,ct);
    }
    private async Task<bool> CanEdit(GroupEvent e,Guid actor,CancellationToken ct) =>
        await EventCompositionPersistence.CanManageEventAsync(db,authorization,e,actor,ct) ||
        await db.EventRoleAssignments.AsNoTracking().AnyAsync(x=>x.EventId==e.Id && x.MemberId==actor &&
            x.Status==EventRoleAssignmentStatus.Accepted && x.EndedUtc==null &&
            (x.RoleRequirementKey=="ram.author" || x.RoleRequirementKey.EndsWith(":ram.author")),ct);
    private Task<bool> AcceptedDuty(Guid eventId,Guid actor,CancellationToken ct) => db.EventRoleAssignments.AsNoTracking()
        .AnyAsync(x => x.EventId == eventId && x.MemberId == actor && x.Status == EventRoleAssignmentStatus.Accepted && x.EndedUtc == null,ct);
    public async Task<bool> CanReadAsync(GroupEvent e, Guid actor, CancellationToken ct)
    {
        if (await CanEdit(e,actor,ct) || await CanAuditAsync(e,actor,ct)) return true;
        return e.RamAssessment is not null && await AcceptedDuty(e.Id,actor,ct) && await db.EventRamRevisions.AsNoTracking()
            .AnyAsync(x => x.Id == e.RamAssessment!.CurrentRevisionId && x.OnsiteMemberId == actor,ct);
    }
    private async Task<bool> CanManagePolicy(Guid church,Guid actor,CancellationToken ct) =>
        await db.Groups.AnyAsync(x => x.Id == church && x.IsChurch && !x.IsDissolved,ct) &&
        await ChurchMember(church,actor,ct) &&
        await AdminPlatformRoleHelpers.HasPermissionAsync(db,actor,AdminPermissionCatalog.ManageRamPolicies,ct);

    public async Task<AppResult<IReadOnlyList<RamPolicyDto>>> PoliciesAsync(Guid church,Guid actor,CancellationToken ct)
    {
        if (!await CanManagePolicy(church,actor,ct)) return AppResult<IReadOnlyList<RamPolicyDto>>.Forbidden("RAM policy permission and membership of this church are required.");
        var rows = await db.EventRamPolicyVersions.AsNoTracking().Where(x => x.ChurchId == church).OrderByDescending(x => x.Version).ToListAsync(ct);
        return AppResult<IReadOnlyList<RamPolicyDto>>.Success(rows.Count == 0
            ? [new(null,church,0,false,"new",RamPolicyDefaults.Create())] : rows.Select(PolicyDto).ToArray());
    }

    public async Task<AppResult<RamPolicyDto>> SavePolicyAsync(Guid church,Guid actor,RamPolicySaveRequest request,CancellationToken ct)
    {
        if (!await CanManagePolicy(church,actor,ct)) return AppResult<RamPolicyDto>.Forbidden("RAM policy permission and membership of this church are required.");
        var errors = RamEvaluator.ValidatePolicy(request.Data,false);
        if (errors.Count != 0) return AppResult<RamPolicyDto>.Validation(string.Join("\n",errors));
        await using var tx = await db.BeginSerializableTransactionAsync(ct);
        var draft = request.DraftId.HasValue ? await db.EventRamPolicyVersions.FirstOrDefaultAsync(x => x.Id == request.DraftId && x.ChurchId == church,ct) : null;
        if (request.DraftId.HasValue && draft is null) return AppResult<RamPolicyDto>.NotFound("Policy draft not found in this church.");
        if (draft?.IsPublished == true) return AppResult<RamPolicyDto>.Conflict("Published policy versions are immutable. Create a new draft to restore or revise one.");
        if (draft is not null && !Matches(request.ExpectedETag,draft.ConcurrencyToken.ToString("D"))) return AppResult<RamPolicyDto>.PreconditionFailed("Policy changed; reload before saving.");
        if (draft is null)
        {
            if (await db.EventRamPolicyVersions.AnyAsync(x => x.ChurchId == church && !x.IsPublished,ct)) return AppResult<RamPolicyDto>.Conflict("This church already has a policy draft. Reload it before editing.");
            draft = new() { Id=Guid.NewGuid(),ChurchId=church,Version=(await db.EventRamPolicyVersions.Where(x=>x.ChurchId==church).MaxAsync(x=>(int?)x.Version,ct) ?? 0)+1,CreatedByMemberId=actor,CreatedUtc=DateTime.UtcNow };
            db.EventRamPolicyVersions.Add(draft);
        }
        draft.PolicyJson=RamEvaluator.Serialize(request.Data);
        draft.ConcurrencyToken=Guid.NewGuid();
        try { await db.SaveChangesAsync(ct); if(tx is not null) await tx.CommitAsync(ct); }
        catch(DbUpdateException) { return AppResult<RamPolicyDto>.Conflict("Policy changed concurrently; reload before saving."); }
        return AppResult<RamPolicyDto>.Success(PolicyDto(draft));
    }

    public async Task<AppResult<RamPolicyDto>> PublishPolicyAsync(Guid church,Guid policyId,Guid actor,RamPolicyPublishRequest request,CancellationToken ct)
    {
        if (!await CanManagePolicy(church,actor,ct)) return AppResult<RamPolicyDto>.Forbidden("RAM policy permission and membership of this church are required.");
        await using var tx = await db.BeginSerializableTransactionAsync(ct);
        var policy = await db.EventRamPolicyVersions.FirstOrDefaultAsync(x=>x.Id==policyId && x.ChurchId==church,ct);
        if(policy is null) return AppResult<RamPolicyDto>.NotFound("Policy not found.");
        if(policy.IsPublished) return AppResult<RamPolicyDto>.Conflict("This version has already been published.");
        if(!Matches(request.ExpectedETag,policy.ConcurrencyToken.ToString("D"))) return AppResult<RamPolicyDto>.PreconditionFailed("Policy changed; reload the preview.");
        var errors=RamEvaluator.ValidatePolicy(PolicyDto(policy).Data,true);
        if(!request.ConfirmEveryCell || errors.Count>0) return AppResult<RamPolicyDto>.Validation(string.Join("\n",errors.Prepend("Explicit confirmation of every matrix cell is required.")));
        policy.IsPublished=true; policy.PublishedByMemberId=actor; policy.PublishedUtc=DateTime.UtcNow; policy.ConcurrencyToken=Guid.NewGuid();
        try { await db.SaveChangesAsync(ct); if(tx is not null) await tx.CommitAsync(ct); }
        catch(DbUpdateConcurrencyException) { return AppResult<RamPolicyDto>.PreconditionFailed("Policy changed concurrently; reload."); }
        return AppResult<RamPolicyDto>.Success(PolicyDto(policy));
    }

    public async Task<AppResult<RamWorkspaceDto>> GetAsync(Guid eventId,Guid actor,CancellationToken ct)
    {
        var e=await db.GroupEvents.AsNoTracking().Include(x=>x.RamAssessment).FirstOrDefaultAsync(x=>x.Id==eventId,ct);
        if(e is null) return AppResult<RamWorkspaceDto>.NotFound("Event not found.");
        var edit=await CanEdit(e,actor,ct); var audit=await CanAuditAsync(e,actor,ct);
        if(!edit && !audit && !await CanReadAsync(e,actor,ct)) return AppResult<RamWorkspaceDto>.Forbidden("RAM reading permission is required.");
        var church=await EventCompositionPersistence.FindChurchRootIdAsync(db,e.GroupId,ct);
        var policy=await db.EventRamPolicyVersions.AsNoTracking().Where(x=>x.ChurchId==church && x.IsPublished)
            .OrderByDescending(x=>x.Version).FirstOrDefaultAsync(ct);
        var latestPolicy=policy;
        if (e.RamAssessment?.PolicyVersionId is {} referenceId)
            policy = await db.EventRamPolicyVersions.AsNoTracking().FirstOrDefaultAsync(x=>x.Id==referenceId && x.ChurchId==church,ct);
        var history=await db.EventRamRevisions.AsNoTracking().Where(x=>x.EventId==eventId && (edit || audit || x.OnsiteMemberId==actor)).OrderByDescending(x=>x.Version).ToListAsync(ct);
        var ids=history.Select(x=>x.Id).ToArray();
        var actions=await db.EventRamActions.AsNoTracking().Where(x=>x.EventId==eventId && ids.Contains(x.RevisionId)).OrderBy(x=>x.CreatedUtc).ToListAsync(ct);
        var candidates=edit ? await (from role in db.EventRoleAssignments.AsNoTracking()
            join m in db.Members.AsNoTracking() on role.MemberId equals m.Id
            where role.EventId==eventId && role.Status==EventRoleAssignmentStatus.Accepted && role.EndedUtc==null
            select new RamPerson(m.Id,m.DisplayName ?? "Member")).Distinct().ToListAsync(ct) : [];
        return AppResult<RamWorkspaceDto>.Success(new(e.RamAssessment is null?null:EventRamPolicy.ToDto(e.RamAssessment,e.GroupId),
            policy is null?null:PolicyDto(policy),history.Select(RevisionDto).ToArray(),actions.Select(ActionDto).ToArray(),candidates,edit,audit,actor,IsRequired(e),latestPolicy is null?null:PolicyDto(latestPolicy)));
    }

    public async Task<AppResult<EventRamAssessmentDto>> SaveAsync(Guid eventId,Guid actor,RamSaveRequest request,CancellationToken ct)
    {
        await using var tx=await db.BeginSerializableTransactionAsync(ct);
        var e=await db.GroupEvents.Include(x=>x.RamAssessment).FirstOrDefaultAsync(x=>x.Id==eventId,ct);
        if(e is null) return AppResult<EventRamAssessmentDto>.NotFound("Event not found.");
        if(!await CanEdit(e,actor,ct)) return AppResult<EventRamAssessmentDto>.Forbidden("Event author permission is required.");
        if(!Matches(request.ExpectedETag,Token(e.RamAssessment))) return AppResult<EventRamAssessmentDto>.PreconditionFailed("RAM changed; reload before saving. / RAM 已改变，请重新载入。");
        if(await EventPreparationPolicy.IsFrozenAsync(db,eventId,ct)) return AppResult<EventRamAssessmentDto>.Conflict(EventPreparationPolicy.FrozenMessage);
        var church=await EventCompositionPersistence.FindChurchRootIdAsync(db,e.GroupId,ct);
        var policy=request.PolicyVersionId.HasValue?await db.EventRamPolicyVersions.AsNoTracking().FirstOrDefaultAsync(x=>x.Id==request.PolicyVersionId && x.ChurchId==church && x.IsPublished,ct):null;
        if(request.PolicyVersionId.HasValue && policy is null) return AppResult<EventRamAssessmentDto>.Validation("The published RAM policy must belong to the Event's church.");
        RamEvaluation evaluation;
        try { evaluation=RamEvaluator.Evaluate(RamEvaluator.Parse(request.RamDataJson),policy is null?null:PolicyDto(policy).Data); }
        catch(JsonException) { return AppResult<EventRamAssessmentDto>.Validation("RAM must be a valid version 2 JSON object."); }
        evaluation.Draft.SchemaVersion=2;
        var ram=e.RamAssessment;
        if (ram?.SchemaVersion==2 && ram.PolicyVersionId==policy?.Id && ram.RamDataJson==RamEvaluator.Serialize(evaluation.Draft))
            return AppResult<EventRamAssessmentDto>.Success(EventRamPolicy.ToDto(ram,e.GroupId));
        if(ram is null) { ram=new(){EventId=eventId,CreatedUtc=DateTime.UtcNow}; db.EventRamAssessments.Add(ram); e.RamAssessment=ram; }
        await ArchiveLegacyAsync(db,ram,actor,ct);
        var wasReviewed=ram.Status!=EventRamStatus.Draft || ram.CurrentRevisionId.HasValue || ram.Validity=="ReviewRequired";
        ram.SchemaVersion=2; ram.AuthorMemberId=actor; ram.PolicyVersionId=policy?.Id;
        ram.RamDataJson=RamEvaluator.Serialize(evaluation.Draft); ram.ResidualLevel=evaluation.ResidualLevel;
        Invalidate(ram,wasReviewed?"ReviewRequired":"Draft");
        e.UpdatedUtc=DateTime.UtcNow;
        if(e.PublicationStatus==EventPublicationStatus.LegacyImplicit)
        {
            e.PublicationStatus=EventPublicationStatus.Unpublished;
            e.PublicationConcurrencyToken=Guid.NewGuid();
        }
        await packages.InvalidateForMaterialChangeAsync(e,actor,"event.ram.changed","governanceCritical",ct);
        await EventWorkflowIntegration.SyncRamAsync(db,eventId,ram.Status,ram.RamDataJson,actor,ram.UpdatedUtc,ct);
        try { await db.SaveChangesAsync(ct); if(tx is not null) await tx.CommitAsync(ct); }
        catch(DbUpdateConcurrencyException) { return AppResult<EventRamAssessmentDto>.PreconditionFailed("RAM changed concurrently; reload."); }
        await cache.RemoveGroupEventsAsync(e.GroupId,ct);
        return AppResult<EventRamAssessmentDto>.Success(EventRamPolicy.ToDto(ram,e.GroupId));
    }

    public async Task<AppResult<EventRamAssessmentDto>> ActAsync(Guid eventId,Guid actor,string action,RamActionRequest request,string? key,CancellationToken ct)
    {
        if(key is null || key.Length is < 8 or > 120) return AppResult<EventRamAssessmentDto>.Validation("An 8–120 character Idempotency-Key is required.");
        if(request.Reason?.Length>4000) return AppResult<EventRamAssessmentDto>.Validation("The reason is too long.");
        await using var tx=await db.BeginSerializableTransactionAsync(ct);
        var e=await db.GroupEvents.Include(x=>x.RamAssessment).FirstOrDefaultAsync(x=>x.Id==eventId,ct);
        if(e?.RamAssessment is not { } ram) return AppResult<EventRamAssessmentDto>.NotFound("RAM not found.");
        if(!await CanReadAsync(e,actor,ct)) return AppResult<EventRamAssessmentDto>.Forbidden("RAM reading permission is required.");
        var hash=Hash(new{eventId,actor,action,request});
        var replay=await db.EventRamActions.AsNoTracking().FirstOrDefaultAsync(x=>x.EventId==eventId && x.ActorMemberId==actor && x.IdempotencyKey==key,ct);
        if(replay is not null) return replay.RequestHash==hash ? AppResult<EventRamAssessmentDto>.Success(EventRamPolicy.ToDto(ram,e.GroupId)) : AppResult<EventRamAssessmentDto>.Conflict("Idempotency key was used for different content.");
        if(ram.SchemaVersion!=2 && action!="request-review") return AppResult<EventRamAssessmentDto>.Conflict(UpgradeMessage);
        if(!Matches(request.ExpectedETag,Token(ram))) return AppResult<EventRamAssessmentDto>.PreconditionFailed("RAM changed; reload the specified version.");
        if(await EventPreparationPolicy.IsFrozenAsync(db,eventId,ct)) return AppResult<EventRamAssessmentDto>.Conflict(EventPreparationPolicy.FrozenMessage);
        var edit=await CanEdit(e,actor,ct); var audit=await CanAuditAsync(e,actor,ct);
        var revision=await db.EventRamRevisions.FirstOrDefaultAsync(x=>x.Id==ram.CurrentRevisionId && x.EventId==eventId,ct);
        if(action=="snapshot-draft")
        {
            if(!edit) return AppResult<EventRamAssessmentDto>.Forbidden("Only an Event author can snapshot a draft.");
            revision=await Snapshot(ram,null,ct);
        }
        else if(action=="request-confirmation")
        {
            if(!edit) return AppResult<EventRamAssessmentDto>.Forbidden("Only an Event author can request confirmation.");
            var validation=await EvaluateCurrent(e,ct);
            if(validation.Errors.Count>0) return AppResult<EventRamAssessmentDto>.Validation(string.Join("\n",validation.Errors));
            var onsite=validation.Draft.AuthorAttendsAndLeads==true?ram.AuthorMemberId:validation.Draft.OnsiteMemberId;
            if(!onsite.HasValue || (validation.Draft.AuthorAttendsAndLeads==false && !await AcceptedDuty(eventId,onsite.Value,ct))) return AppResult<EventRamAssessmentDto>.Validation("The on-site leader must have personally accepted an Event duty.");
            // Re-requesting confirmation creates a new immutable version and invalidates previous signatures.
            revision=await Snapshot(ram,onsite,ct); Invalidate(ram,"AwaitingConfirmation"); ram.CurrentRevisionId=revision.Id;
            db.NotificationMessages.Add(new(){Id=Guid.NewGuid(),RecipientMemberId=onsite.Value,CreatedByMemberId=actor,GroupId=e.GroupId,EventId=eventId,
                ActionType="event.ram.confirmationRequested",ActionDataJson=RamEvaluator.Serialize(new{eventId,revisionId=revision.Id,actionUrl=$"/events/{eventId}/ram",
                    title=new RamText("Confirm on-site RAM responsibilities","确认 RAM 现场职责"),body=new RamText("Review the fixed RAM version and confirm personally.","请查看固定 RAM 版本并由本人确认。")}),OccurredUtc=DateTime.UtcNow,CreatedUtc=DateTime.UtcNow,UpdatedUtc=DateTime.UtcNow});
        }
        else if(action=="request-review")
        {
            if(!edit && !audit) return AppResult<EventRamAssessmentDto>.Forbidden("The Event lead or safety reviewer must request re-review.");
            if(string.IsNullOrWhiteSpace(request.Reason)) return AppResult<EventRamAssessmentDto>.Validation("Explain why re-review is required.");
            await ArchiveLegacyAsync(db,ram,actor,ct);
            revision ??= await Snapshot(ram,null,ct);
            Invalidate(ram,"ReviewRequired"); ram.ReviewRequested=true;
        }
        else
        {
            if(revision is null || revision.Id!=request.RevisionId) return AppResult<EventRamAssessmentDto>.Conflict("This is not the current immutable RAM version.");
            if(action is "submit" or "approve" && revision.OnsiteMemberId is {} onsiteActor && revision.AuthorMemberId!=onsiteActor && !await AcceptedDuty(eventId,onsiteActor,ct))
                return AppResult<EventRamAssessmentDto>.Conflict("The on-site duty is no longer accepted; request a new confirmation.");
            if(action=="confirm")
            {
                if(revision.OnsiteMemberId!=actor) return AppResult<EventRamAssessmentDto>.Forbidden("Only the named on-site leader can sign; proxy signatures are forbidden.");
                if(revision.AuthorMemberId!=actor && !await AcceptedDuty(eventId,actor,ct)) return AppResult<EventRamAssessmentDto>.Forbidden("The on-site duty is no longer accepted.");
                if(ram.Validity!="AwaitingConfirmation") return AppResult<EventRamAssessmentDto>.Conflict("This version is not awaiting confirmation.");
                ram.Validity="Confirmed";
            }
            else if(action=="submit")
            {
                if(!edit) return AppResult<EventRamAssessmentDto>.Forbidden("Only an Event author can submit RAM.");
                if(ram.Validity!="Confirmed" || !await db.EventRamActions.AnyAsync(x=>x.RevisionId==revision.Id && x.Action=="confirm" && x.ActorMemberId==revision.OnsiteMemberId,ct)) return AppResult<EventRamAssessmentDto>.Conflict("The on-site leader must personally confirm this version first.");
                var validation=await EvaluateCurrent(e,ct);
                if(validation.Errors.Count>0) return AppResult<EventRamAssessmentDto>.Validation(string.Join("\n",validation.Errors));
                ram.Status=EventRamStatus.AwaitingReview; ram.Validity="AwaitingReview"; ram.SubmittedByMemberId=actor; ram.SubmittedUtc=DateTime.UtcNow;
            }
            else if(action is "approve" or "return")
            {
                if(!audit) return AppResult<EventRamAssessmentDto>.Forbidden("A safety reviewer in this church is required.");
                if(actor==revision.AuthorMemberId || actor==revision.OnsiteMemberId || actor==ram.SubmittedByMemberId) return AppResult<EventRamAssessmentDto>.Forbidden("Authors, submitters and on-site signers cannot review their own version.");
                if(ram.Status!=EventRamStatus.AwaitingReview || ram.Validity!="AwaitingReview") return AppResult<EventRamAssessmentDto>.Conflict("Only the current submitted RAM version can be reviewed.");
                if(action=="return")
                {
                    if(string.IsNullOrWhiteSpace(request.Reason)) return AppResult<EventRamAssessmentDto>.Validation("Explain the changes needed.");
                    Invalidate(ram,"Returned");
                }
                else
                {
                    var validation=await EvaluateCurrent(e,ct);
                    if(validation.Errors.Count>0) return AppResult<EventRamAssessmentDto>.Validation(string.Join("\n",validation.Errors));
                    if(ram.ResidualLevel=="Red" && (!request.HealthSafetySigned || string.IsNullOrWhiteSpace(request.Reason))) return AppResult<EventRamAssessmentDto>.Validation("Red residual risk requires explicit health and safety sign-off and a recorded rationale; Enhanced Event Package approval is also required.");
                    ram.Status=EventRamStatus.Approved; ram.Validity="Valid"; ram.ApprovedByMemberId=actor; ram.ApprovedUtc=DateTime.UtcNow; ram.ReviewRequested=false;
                }
            }
            else return AppResult<EventRamAssessmentDto>.Validation("Unknown RAM action.");
        }
        db.EventRamActions.Add(new(){Id=Guid.NewGuid(),EventId=eventId,RevisionId=revision!.Id,ActorMemberId=actor,Action=action,Reason=request.Reason ?? "",HealthSafetySigned=request.HealthSafetySigned,IdempotencyKey=key,RequestHash=hash,CreatedUtc=DateTime.UtcNow});
        if(action is "request-review" or "return")
        {
            var policy=await db.EventRamPolicyVersions.AsNoTracking().FirstOrDefaultAsync(x=>x.Id==ram.PolicyVersionId,ct);
            var days=policy is null?7:PolicyDto(policy).Data.ReviewRules.ReviewReminderDays;
            db.EventTasks.Add(new(){Id=Guid.NewGuid(),EventId=eventId,AssignedMemberId=ram.AuthorMemberId??e.AccountableOwnerMemberId,
                TitleEn="Review and resubmit the RAM",TitleZh="复查并重新提交 RAM",DescriptionEn="Open the restricted RAM workspace to review the requested changes.",DescriptionZh="请进入受限 RAM 工作区查看所需修改。",
                IsRequired=true,IsRestricted=true,DueUtc=DateTime.UtcNow.AddDays(days),CreatedUtc=DateTime.UtcNow,UpdatedUtc=DateTime.UtcNow});
        }
        ram.ConcurrencyToken=Guid.NewGuid(); ram.UpdatedUtc=DateTime.UtcNow; e.UpdatedUtc=ram.UpdatedUtc;
        if(action!="snapshot-draft")
        {
            await EventWorkflowIntegration.SyncRamAsync(db,eventId,ram.Status,ram.RamDataJson,actor,ram.UpdatedUtc,ct);
            await packages.InvalidateForMaterialChangeAsync(e,actor,$"event.ram.{action}","governanceCritical",ct);
        }
        try { await db.SaveChangesAsync(ct); if(tx is not null) await tx.CommitAsync(ct); }
        catch(DbUpdateConcurrencyException) { return AppResult<EventRamAssessmentDto>.PreconditionFailed("RAM changed concurrently; reload."); }
        catch(DbUpdateException) { return AppResult<EventRamAssessmentDto>.Conflict("RAM action raced another request; reload and retry with the same key."); }
        await cache.RemoveGroupEventsAsync(e.GroupId,ct);
        return AppResult<EventRamAssessmentDto>.Success(EventRamPolicy.ToDto(ram,e.GroupId));
    }

    private async Task<RamEvaluation> EvaluateCurrent(GroupEvent e,CancellationToken ct)
    {
        var ram=e.RamAssessment!;
        var church=await EventCompositionPersistence.FindChurchRootIdAsync(db,e.GroupId,ct);
        var policy=await db.EventRamPolicyVersions.AsNoTracking().FirstOrDefaultAsync(x=>x.Id==ram.PolicyVersionId && x.IsPublished && x.ChurchId==church,ct);
        return RamEvaluator.Evaluate(RamEvaluator.Parse(ram.RamDataJson),policy is null?null:PolicyDto(policy).Data);
    }
    private async Task<EventRamRevision> Snapshot(EventRamAssessment ram,Guid? onsite,CancellationToken ct)
    {
        var maxVersion=Math.Max(await db.EventRamRevisions.Where(x=>x.EventId==ram.EventId).MaxAsync(x=>(int?)x.Version,ct)??0,
            db.EventRamRevisions.Local.Where(x=>x.EventId==ram.EventId).Select(x=>x.Version).DefaultIfEmpty(0).Max());
        var revision=new EventRamRevision{Id=Guid.NewGuid(),EventId=ram.EventId,Version=maxVersion+1,
            SchemaVersion=ram.SchemaVersion,PolicyVersionId=ram.PolicyVersionId,RamDataJson=ram.RamDataJson,ContentHash=Hash(new{ram.RamDataJson,ram.PolicyVersionId}),ResidualLevel=ram.ResidualLevel,
            AuthorMemberId=ram.AuthorMemberId ?? ram.SubmittedByMemberId ?? Guid.Empty,OnsiteMemberId=onsite,CreatedUtc=DateTime.UtcNow};
        db.EventRamRevisions.Add(revision); return revision;
    }
    public static async Task ArchiveLegacyAsync(IAlifeDbContext db,EventRamAssessment ram,Guid actor,CancellationToken ct)
    {
        if(ram.SchemaVersion!=1 || await db.EventRamRevisions.AnyAsync(x=>x.EventId==ram.EventId && x.SchemaVersion==1,ct) || db.EventRamRevisions.Local.Any(x=>x.EventId==ram.EventId && x.SchemaVersion==1)) return;
        var revision=new EventRamRevision{Id=Guid.NewGuid(),EventId=ram.EventId,Version=1,SchemaVersion=1,RamDataJson=ram.RamDataJson,ContentHash=Hash(ram.RamDataJson),AuthorMemberId=ram.SubmittedByMemberId??actor,CreatedUtc=ram.UpdatedUtc};
        db.EventRamRevisions.Add(revision);
        if(ram.SubmittedByMemberId is {} submitter) db.EventRamActions.Add(new(){Id=Guid.NewGuid(),EventId=ram.EventId,RevisionId=revision.Id,ActorMemberId=submitter,Action="legacy-submitted",CreatedUtc=ram.SubmittedUtc??ram.UpdatedUtc,IdempotencyKey=$"legacy-submit-{revision.Id}",RequestHash=revision.ContentHash});
        if(ram.ApprovedByMemberId is {} approver) db.EventRamActions.Add(new(){Id=Guid.NewGuid(),EventId=ram.EventId,RevisionId=revision.Id,ActorMemberId=approver,Action="legacy-approved",CreatedUtc=ram.ApprovedUtc??ram.UpdatedUtc,IdempotencyKey=$"legacy-{revision.Id}",RequestHash=revision.ContentHash});
    }
    public static void Invalidate(EventRamAssessment ram,string validity="ReviewRequired")
    {
        ram.Status=EventRamStatus.Draft; ram.Validity=validity; ram.CurrentRevisionId=null; ram.SubmittedByMemberId=null; ram.SubmittedUtc=null; ram.ApprovedByMemberId=null; ram.ApprovedUtc=null;
        ram.ConcurrencyToken=Guid.NewGuid(); ram.UpdatedUtc=DateTime.UtcNow;
    }

    public async Task<AppResult<RamPrintDto>> PrintAsync(Guid eventId,Guid revisionId,Guid actor,CancellationToken ct)
    {
        var e=await db.GroupEvents.AsNoTracking().Include(x=>x.RamAssessment).FirstOrDefaultAsync(x=>x.Id==eventId,ct);
        if(e is null) return AppResult<RamPrintDto>.NotFound("Event not found.");
        var r=await db.EventRamRevisions.AsNoTracking().FirstOrDefaultAsync(x=>x.EventId==eventId && x.Id==revisionId,ct);
        if(r is null) return AppResult<RamPrintDto>.NotFound("RAM version not found.");
        if(!await CanEdit(e,actor,ct) && !await CanAuditAsync(e,actor,ct) && !(r.OnsiteMemberId==actor && await AcceptedDuty(eventId,actor,ct))) return AppResult<RamPrintDto>.Forbidden("RAM reading permission is required for printing this version.");
        var p=await db.EventRamPolicyVersions.AsNoTracking().FirstOrDefaultAsync(x=>x.Id==r.PolicyVersionId,ct);
        var actions=await db.EventRamActions.AsNoTracking().Where(x=>x.RevisionId==revisionId).OrderBy(x=>x.CreatedUtc).ToListAsync(ct);
        var current=e.RamAssessment?.CurrentRevisionId==revisionId;
        return AppResult<RamPrintDto>.Success(new(RevisionDto(r),r.RamDataJson,p is null?null:PolicyDto(p),actions.Select(ActionDto).ToArray(),current,current?e.RamAssessment!.Validity:"Historical",
            !actions.Any(x=>x.Action is "approve" or "legacy-approved")));
    }

    public static bool IsRequired(GroupEvent e, EventPlanProposalDto? plan = null)
    {
        if(e.RamAssessment?.ReviewRequested==true) return true;
        if(plan?.ActivityTypeCode=="outdoor-activity" || plan?.ArchetypeCode=="camp-retreat") return true;
        if(plan?.Facts.Items.Any(f=>f.Certainty==EventFactCertainty.Confirmed &&
            f.Code is "safety.requiresRam" or "safety.highRisk" or "place.offsite" or "place.outdoor" or "move.accommodationRequired" &&
            f.Value?.ValueKind==JsonValueKind.True)==true) return true;
        try
        {
            var draft=e.RamAssessment is null?null:RamEvaluator.Parse(e.RamAssessment.RamDataJson);
            if(draft is { IsOuting:true } or { IsOvernight:true } or { IsHighRisk:true } || draft?.Activities.Any(x=>x.Type is "hiking" or "water" or "camp" or "outdoor")==true) return true;
            using var json=JsonDocument.Parse(e.EventDataJson);
            return HasTrigger(json.RootElement);
        }
        catch(JsonException) { return true; }
    }
    private static bool HasTrigger(JsonElement element)
    {
        if(element.ValueKind==JsonValueKind.Object)
            foreach(var p in element.EnumerateObject())
                if((p.Name is "requiresRam" or "isOuting" or "isOutdoor" or "isOffsite" or "isOvernight" or "isHighRisk" && p.Value.ValueKind==JsonValueKind.True) || HasTrigger(p.Value)) return true;
        if(element.ValueKind==JsonValueKind.Array) return element.EnumerateArray().Any(HasTrigger);
        return false;
    }
}
