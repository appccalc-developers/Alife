using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Microsoft.EntityFrameworkCore;
namespace Alife.Application.Events.Services;

public sealed partial class EventRegistrationWorkService
{
    public static async Task<bool> HasCurrentFeeApprovalAsync(Alife.Application.Common.Interfaces.IAlifeDbContext db, Alife.Domain.Entities.GroupEvent e, Alife.Domain.Entities.EventRegistrationPolicy p, CancellationToken ct)
        => p.FeeApprovalStatus == "approved" && p.FeeApprovedByMemberId is { } reviewer && p.FeeSubmittedByMemberId is { } submitter && reviewer != submitter &&
            await EventWorkAccess.EnabledAsync(db, e.Id, "MONEY.FINANCE", ct) &&
            await EventWorkAccess.RoleAsync(db, e, reviewer, "MONEY.FINANCE", "finance.approver", ct) &&
            !await EventWorkAccess.RoleAsync(db, e, reviewer, "MONEY.FINANCE", "finance.owner", ct) &&
            await EventWorkAccess.RoleAsync(db, e, submitter, "MONEY.FINANCE", "finance.owner", ct);
    public async Task<AppResult<RegistrationPolicyDto>> FeesAsync(Guid eventId, Guid actor, string operation, string? reason, string? expected, string? key, CancellationToken ct)
    {
        if (operation is not ("submit" or "approve" or "return")) return AppResult<RegistrationPolicyDto>.Validation("Unknown fee action.");
        if ((reason?.Length ?? 0) > 2000) return AppResult<RegistrationPolicyDto>.Validation("Reason must be at most 2,000 characters.");
        await using var tx = await db.BeginSerializableTransactionAsync(ct); await db.LockEventRegistrationAsync(eventId, ct);
        var e = await db.GroupEvents.FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (e is null) return AppResult<RegistrationPolicyDto>.NotFound("Event not found.");
        if (!await EventWorkAccess.EnabledAsync(db,eventId,"MONEY.FINANCE",ct)) return AppResult<RegistrationPolicyDto>.Conflict("Registration fee management is disabled.");
        if (operation == "submit" ? !await Finance(e, actor, ct) : !await FeeApprover(e, actor, ct)) return AppResult<RegistrationPolicyDto>.Forbidden("The appropriate finance responsibility is required.");
        var policy = await db.EventRegistrationPolicies.FirstOrDefaultAsync(x => x.EventId == eventId, ct);
        if (policy is null || Rules(policy).FeeMinor <= 0) return AppResult<RegistrationPolicyDto>.Conflict("No registration fee is configured.");
        var input = new { operation, reason, policy.Version };
        var replay = await Replay(eventId, actor, "fees." + operation, input, key, ct);
        if (replay is not null) return replay.IsSuccess ? AppResult<RegistrationPolicyDto>.Success(new(policy.Version, Rules(policy), PolicyETag(policy), policy.FeeApprovalStatus)) : AppResult<RegistrationPolicyDto>.Conflict("Fee action key conflicts with another request.");
        if (expected != PolicyETag(policy)) return AppResult<RegistrationPolicyDto>.PreconditionFailed("The fee plan changed.");
        if (await EventPreparationPolicy.IsFrozenAsync(db, eventId, ct)) return AppResult<RegistrationPolicyDto>.Conflict(EventPreparationPolicy.FrozenMessage);
        if (operation == "submit")
        {
            if (policy.FeeApprovalStatus == "pending") return AppResult<RegistrationPolicyDto>.Conflict("Fee review is already pending.");
            policy.FeeSubmittedByMemberId = actor; policy.FeeApprovedByMemberId = null; policy.FeeApprovalStatus = "pending";
        }
        else
        {
            if (policy.FeeApprovalStatus != "pending" || policy.FeeSubmittedByMemberId == actor || await Finance(e, actor, ct)) return AppResult<RegistrationPolicyDto>.Forbidden("Fee review must be independent of the finance owner and submitter.");
            if (policy.FeeSubmittedByMemberId is not { } submitter || !await Finance(e, submitter, ct)) return AppResult<RegistrationPolicyDto>.Conflict("The submitting finance owner no longer holds that responsibility.");
            if (operation == "return" && (string.IsNullOrWhiteSpace(reason) || reason.Length > 2000)) return AppResult<RegistrationPolicyDto>.Validation("A return reason is required.");
            policy.FeeApprovalStatus = operation == "approve" ? "approved" : "returned";
            policy.FeeApprovedByMemberId = operation == "approve" ? actor : null;
        }
        policy.ConcurrencyToken = Guid.NewGuid(); policy.UpdatedUtc = DateTime.UtcNow;
        Audit(eventId, actor, "fees." + operation, policy.RulesJson, evidence: reason);
        Remember(eventId, actor, "fees." + operation, input, key!, eventId);
        await invalidation.InvalidateForModuleChangeAsync(e, actor, "MONEY.FINANCE", "event.registration.feeApproval", "operational", ct);
        await db.SaveChangesAsync(ct); if (tx is not null) await tx.CommitAsync(ct);
        return AppResult<RegistrationPolicyDto>.Success(new(policy.Version, Rules(policy), PolicyETag(policy), policy.FeeApprovalStatus));
    }
}
