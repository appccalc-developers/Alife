using System.Text.Json;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public sealed partial class EventRegistrationWorkService
{
    public async Task<AppResult<Guid>> ActAsync(Guid eventId, Guid applicationId, Guid actor, string operation, RegistrationActionRequest input, string? expected, string? key, CancellationToken ct)
    {
        if (operation is not ("send-invitation" or "answers" or "consent" or "verify-consent" or "verify-eligibility" or "verify-materials" or "complete" or "cancel" or "split" or "payment" or "refund" or "remove-material" or "revoke-proxy")) return AppResult<Guid>.Validation("Unknown registration action.");
        if ((input.Evidence?.Length ?? 0) > 2000) return AppResult<Guid>.Validation("Evidence must be at most 2,000 characters.");
        await using var tx = await db.BeginSerializableTransactionAsync(ct); await db.LockEventRegistrationAsync(eventId, ct);
        var application = await db.EventRegistrationApplications.Include(x => x.Event).Include(x => x.Participants).FirstOrDefaultAsync(x => x.EventId == eventId && x.Id == applicationId, ct);
        if (application is null) return AppResult<Guid>.NotFound("Application not found.");
        var e = application.Event; var manager = await Manager(e, actor, ct); var finance = await Finance(e, actor, ct);
        if (operation is not ("cancel" or "refund" or "revoke-proxy") && !await EventWorkAccess.EnabledAsync(db, eventId, "PEOPLE.REGISTRATION", ct)) return AppResult<Guid>.Conflict("Registration is disabled for this event.");
        var participant = application.Participants.FirstOrDefault(x => x.Id == input.ParticipantId);
        var proxy = application.OrganiserMemberId == actor;
        var self = participant?.IsChild == true ? participant.GuardianMemberId == actor : participant?.MemberId == actor;
        if (!manager && proxy && !self && (participant?.ProxyAccessRevoked == true || participant is null && application.Participants.Any(p => p.ProxyAccessRevoked)))
            return AppResult<Guid>.Forbidden("A participant withdrew proxy authority. Their account or the registration manager must handle their procedures.");
        if (!manager && !finance && !proxy && !self) return AppResult<Guid>.Forbidden("This application belongs to another person.");
        if (operation is "send-invitation" or "verify-consent" or "verify-eligibility" or "verify-materials" ? !manager : operation is "payment" or "refund" ? !finance : !manager && !proxy && !self) return AppResult<Guid>.Forbidden("This action requires its designated role.");
        var replayInput = new { applicationId, input }; var replay = await Replay(eventId, actor, operation, replayInput, key, ct); if (replay is not null) return replay;
        if (expected != ApplicationETag(application)) return AppResult<Guid>.PreconditionFailed("Registration changed. Reload and review.");
        var policy = await db.EventRegistrationPolicies.FirstOrDefaultAsync(x => x.EventId == eventId, ct);
        if (policy is null) return AppResult<Guid>.Conflict("Registration rules not found.");
        var rules = Rules(policy); var now = DateTime.UtcNow;
        if (operation is not ("cancel" or "refund" or "revoke-proxy") && (application.PolicyVersion != policy.Version && !application.Participants.All(x => x.IsLegacy))) return AppResult<Guid>.Conflict("Registration rules changed. A manager must replace this invitation; new consent is required.");
        if (operation is not ("cancel" or "refund" or "revoke-proxy") && rules.DeadlineUtc < now) return AppResult<Guid>.Conflict("Registration deadline has passed.");
        if (application.IsInvitation && application.InvitedUtc is null && operation is not ("send-invitation" or "cancel" or "revoke-proxy") && !manager) return AppResult<Guid>.Forbidden("The invitation has not been sent.");
        if (application.IsInvitation && application.InvitedUtc.HasValue && application.ReservationExpiresUtc <= now &&
            application.Participants.Any(x => x.SeatStatus == "reserved") && operation is not ("cancel" or "refund" or "revoke-proxy"))
            return AppResult<Guid>.Conflict("The invitation has expired; its reserved places are no longer available.");
        if (input.ParticipantId.HasValue && participant is null) return AppResult<Guid>.Validation("The participant does not belong to this application.");
        if (operation is not ("send-invitation" or "cancel" or "split" or "complete") && participant is null) return AppResult<Guid>.Validation("Choose a participant from this application.");
        if (participant is not null && participant.SeatStatus is "cancelled" or "expired" && operation is not ("refund" or "revoke-proxy")) return AppResult<Guid>.Conflict("This participant's application has ended.");
        switch (operation)
        {
            case "revoke-proxy":
                if (!self && (!manager || string.IsNullOrWhiteSpace(input.Evidence))) return AppResult<Guid>.Forbidden("The participant or guardian withdraws authority; an offline withdrawal requires manager evidence.");
                participant!.ProxyAccessRevoked = true;
                break;
            case "send-invitation":
                if (!application.IsInvitation || application.InvitedUtc is not null) return AppResult<Guid>.Conflict("This invitation has already been sent or is not an invitation.");
                if (application.Participants.Any(x => x.SeatStatus != "draft")) return AppResult<Guid>.Conflict("Cancelled invitations cannot be sent.");
                if (!await ApprovedAsync(e, ct)) return AppResult<Guid>.Conflict("Approve the Event Package before sending a pre-registration invitation.");
                if (application.ReservationExpiresUtc <= now) return AppResult<Guid>.Conflict("The invitation deadline has passed.");
                await ExpireAsync(e, ct);
                var reservedCount = await db.EventRegistrationParticipants.CountAsync(x => x.Application.EventId == eventId && (x.SeatStatus == "confirmed" || x.SeatStatus == "reserved" && x.Application.ReservationExpiresUtc > now), ct);
                if (await db.EventRegistrationParticipants.AnyAsync(x => x.Application.EventId == eventId && x.SeatStatus == "waitlisted", ct) || reservedCount + application.Participants.Count > rules.Capacity) return AppResult<Guid>.Conflict("Not enough unallocated capacity for this invitation; existing waiters have priority.");
                application.InvitedUtc = now;
                foreach (var p in application.Participants) p.SeatStatus = "reserved";
                Notice(e, application.OrganiserMemberId, actor, "event.registration.invited", application.Id);
                break;
            case "answers":
                if (!manager && !proxy && !self) return AppResult<Guid>.Forbidden("Only an authorised participant or organiser can fill answers.");
                if (input.AnswersJson is null || input.AnswersJson.Length > 50000) return AppResult<Guid>.Validation("Answers are required (up to 50,000 characters).");
                try
                {
                    using var answers = JsonDocument.Parse(input.AnswersJson);
                    if (answers.RootElement.ValueKind != JsonValueKind.Object || answers.RootElement.EnumerateObject().Any(x => !rules.Materials.Any(r => r.Id == x.Name && r.Kind == "text") || x.Value.ValueKind != JsonValueKind.String || x.Value.GetString()!.Length > 10000)) return AppResult<Guid>.Validation("Answers must use the configured text fields.");
                }
                catch (JsonException) { return AppResult<Guid>.Validation("Invalid answer format."); }
                if (participant!.SeatStatus == "confirmed") return AppResult<Guid>.Conflict("Contact the manager before replacing a confirmed submission.");
                participant.AnswersJson = input.AnswersJson; participant.MaterialsVerified = false; participant.ProcedureStatus = "incomplete";
                break;
            case "consent":
                if (!self) return AppResult<Guid>.Forbidden("Adults confirm for themselves; children require the named guardian. Proxy entry is not consent.");
                participant!.ConsentMethod = participant.IsChild ? "guardianOnline" : "selfOnline";
                participant.ConsentedUtc = now; participant.ConsentRecordedByMemberId = actor; participant.ConsentEvidence = "";
                break;
            case "verify-consent":
                if (string.IsNullOrWhiteSpace(input.Evidence) || input.OccurredUtc is not { } when || when.Kind != DateTimeKind.Utc || when > now) return AppResult<Guid>.Validation("Record the consent time, method and basis after checking the person or guardian.");
                participant!.ConsentMethod = participant.IsChild ? "guardianOffline" : "selfOffline";
                participant.ConsentedUtc = when; participant.ConsentRecordedByMemberId = actor; participant.ConsentEvidence = input.Evidence;
                break;
            case "verify-eligibility":
            case "verify-materials":
                if (string.IsNullOrWhiteSpace(input.Evidence)) return AppResult<Guid>.Validation("Record the basis for verification.");
                if (operation == "verify-eligibility") participant!.EligibilityVerified = true; else participant!.MaterialsVerified = true;
                break;
            case "remove-material":
                if (participant!.SeatStatus == "confirmed") return AppResult<Guid>.Conflict("Confirmed materials cannot be replaced.");
                var material = await db.EventRegistrationMaterials.Include(x => x.FileAsset).FirstOrDefaultAsync(x => x.ParticipantId == participant.Id && x.FileAssetId == input.FileAssetId && !x.FileAsset.IsDeleted, ct);
                if (material is null) return AppResult<Guid>.NotFound("Material not found for this participant.");
                material.FileAsset.IsDeleted = true; material.FileAsset.UpdatedUtc = now;
                participant.MaterialsVerified = false; participant.ProcedureStatus = "incomplete";
                break;
            case "payment":
                if (!await HasCurrentFeeApprovalAsync(db, e, policy, ct) || !await ApprovedAsync(e, ct)) return AppResult<Guid>.Conflict("Current Event and fee approvals are required before recording an accepted payment.");
                if (input.AmountMinor is not > 0 || input.AmountMinor > rules.FeeMinor - (participant!.PaidMinor - participant.RefundedMinor) || string.IsNullOrWhiteSpace(input.Evidence)) return AppResult<Guid>.Validation("Record a positive amount no greater than the unpaid fee and its evidence.");
                participant.PaidMinor += input.AmountMinor.Value;
                break;
            case "refund":
                if (participant!.SeatStatus is not ("cancelled" or "expired")) return AppResult<Guid>.Conflict("Cancel the participant before refunding the registration fee.");
                if (input.AmountMinor is not > 0 || input.AmountMinor > participant!.PaidMinor - participant.RefundedMinor || string.IsNullOrWhiteSpace(input.Evidence)) return AppResult<Guid>.Validation("Record a valid refund amount and evidence.");
                participant.RefundedMinor += input.AmountMinor.Value;
                break;
            case "split":
                if (!proxy || input.AllowSplit is null) return AppResult<Guid>.Forbidden("Only the organiser chooses whether the household may split.");
                if (input.AllowSplit == false && application.Participants.Any(x => x.SeatStatus == "confirmed") && application.Participants.Any(x => x.SeatStatus == "waitlisted")) return AppResult<Guid>.Conflict("Already split assignments need individual cancellation first.");
                application.AllowSplit = input.AllowSplit.Value;
                break;
            case "complete":
                if (!await ApprovedAsync(e, ct) || application.IsInvitation && application.InvitedUtc is null || !application.IsInvitation && (e.RegistrationStatus != EventRegistrationStatus.Open || now < rules.OpensUtc)) return AppResult<Guid>.Conflict("Registration is not currently available.");
                var toComplete = participant is null ? application.Participants.Where(x => x.SeatStatus is not ("cancelled" or "expired" or "confirmed")).ToArray() : [participant];
                foreach (var person in toComplete)
                {
                    if (!manager && !proxy && person.MemberId != actor && person.GuardianMemberId != actor) return AppResult<Guid>.Forbidden("You cannot complete another person's procedures.");
                    var missing = await MissingAsync(rules, policy, e, application, person, ct);
                    if (missing is not null) return AppResult<Guid>.Conflict(missing);
                }
                if (!rules.AllowWaitlist && (application.AllowSplit || application.Participants.All(x => toComplete.Contains(x) || x.ProcedureStatus is "complete" or "legacy" || x.SeatStatus is "cancelled" or "expired")))
                {
                    await ExpireAsync(e, ct);
                    var occupied = await db.EventRegistrationParticipants.CountAsync(x => x.Application.EventId == eventId && (x.SeatStatus == "confirmed" || x.SeatStatus == "reserved" && x.Application.ReservationExpiresUtc > now), ct);
                    var needed = application.Participants.Count(x => x.SeatStatus == "draft" && (toComplete.Contains(x) || x.ProcedureStatus == "complete"));
                    if (needed > rules.Capacity - occupied || needed > 0 && await db.EventRegistrationParticipants.AnyAsync(x => x.Application.EventId == eventId && x.SeatStatus == "waitlisted", ct))
                        return AppResult<Guid>.Conflict("There are not enough places and waitlisting is disabled. / 名额不足，且此活动未开放候补。");
                }
                foreach (var person in toComplete) person.ProcedureStatus = "complete";
                if (application.AllowSplit || application.Participants.All(x => x.ProcedureStatus is "complete" or "legacy" || x.SeatStatus is "cancelled" or "expired"))
                    foreach (var person in application.Participants.Where(x => x.ProcedureStatus == "complete" && x.SeatStatus is "draft" or "reserved"))
                        person.SeatStatus = person.SeatStatus == "reserved" ? "confirmed" : "waitlisted";
                break;
            case "cancel":
                if (participant is not null && !application.AllowSplit && application.Participants.Count > 1)
                    return AppResult<Guid>.Conflict("This household stays together. The organiser must cancel the whole application or explicitly allow splitting first.");
                var cancel = participant is null ? application.Participants.ToArray() : [participant];
                if (!manager && !proxy && cancel.Any(x => x.MemberId != actor && x.GuardianMemberId != actor)) return AppResult<Guid>.Forbidden("Only the organiser, participant or manager may cancel.");
                foreach (var person in cancel) person.SeatStatus = "cancelled";
                break;
        }
        application.ConcurrencyToken = Guid.NewGuid();
        Audit(eventId, actor, operation, JsonSerializer.Serialize(input, Json), application.Id, participant?.Id, input.Evidence);
        Remember(eventId, actor, operation, replayInput, key!, application.Id);
        await db.SaveChangesAsync(ct);
        await ReconcileAsync(e, policy, ct);
        if (!rules.AllowWaitlist && application.Participants.Any(x => x.SeatStatus == "waitlisted"))
        {
            // A rejected capacity request must not leave a queue entry (including the in-memory provider).
            foreach (var person in application.Participants.Where(x => x.SeatStatus == "waitlisted")) person.SeatStatus = "draft";
            await db.SaveChangesAsync(ct);
        }
        await SyncLegacyAsync(application, ct);
        await db.SaveChangesAsync(ct); if (tx is not null) await tx.CommitAsync(ct);
        return AppResult<Guid>.Success(application.Id);
    }

    private async Task<string?> MissingAsync(RegistrationRules rules, EventRegistrationPolicy policy, GroupEvent e, EventRegistrationApplication app, EventRegistrationParticipant person, CancellationToken ct)
    {
        if (person.IsLegacy) return person.MemberId.HasValue && await EventWorkAccess.MemberAsync(db, e.GroupId, person.MemberId.Value, ct) ? null : "Legacy membership is no longer active.";
        if (person.ConsentedUtc is null) return "Personal or guardian consent is still required. / 仍需本人或监护人同意。";
        if (!await Eligible(rules, e, person.MemberId, app.IsInvitation, ct)) return "Participant eligibility is not satisfied.";
        if (rules.ManualReview && !person.EligibilityVerified) return "Manual eligibility review is pending.";
        if (rules.FeeMinor > 0 && (!await HasCurrentFeeApprovalAsync(db, e, policy, ct) || person.PaidMinor - person.RefundedMinor < rules.FeeMinor)) return "The required fee has not been verified under a current independent fee approval.";
        using var answers = JsonDocument.Parse(person.AnswersJson);
        foreach (var requirement in rules.Materials.Where(x => x.Required))
        {
            if (requirement.Kind == "text")
            {
                if (!answers.RootElement.TryGetProperty(requirement.Id, out var text) || text.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(text.GetString())) return "Required text is missing: " + requirement.Label.En;
            }
            else if (!await db.EventRegistrationMaterials.AnyAsync(x => x.ParticipantId == person.Id && x.RequirementId == requirement.Id && !x.FileAsset.IsDeleted, ct)) return "Required material is missing: " + requirement.Label.En;
        }
        if (rules.ManualReview && rules.Materials.Count > 0 && !person.MaterialsVerified) return "Material verification is pending.";
        return null;
    }
    private async Task ExpireAsync(GroupEvent e, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var expired = await db.EventRegistrationApplications.Include(x => x.Participants).Where(x => x.EventId == e.Id && x.ReservationExpiresUtc <= now && x.Participants.Any(p => p.SeatStatus == "reserved")).ToArrayAsync(ct);
        foreach (var app in expired)
        {
            foreach (var p in app.Participants.Where(x => x.SeatStatus == "reserved")) p.SeatStatus = "expired";
            app.ConcurrencyToken = Guid.NewGuid(); Audit(e.Id, EventDutyAccess.OwnerId(e), "reservation.expired", "{}", app.Id);
            Notice(e, app.OrganiserMemberId, EventDutyAccess.OwnerId(e), "event.registration.expired", app.Id);
        }
        if (expired.Length > 0) await db.SaveChangesAsync(ct);
    }
    public async Task ReconcileAsync(GroupEvent e, EventRegistrationPolicy policy, CancellationToken ct)
    {
        await ExpireAsync(e, ct);
        var rules = Rules(policy); var now = DateTime.UtcNow;
        if (!await ApprovedAsync(e, ct) || e.RegistrationStatus != EventRegistrationStatus.Open || now > rules.DeadlineUtc || now < rules.OpensUtc) return;
        var applications = await db.EventRegistrationApplications.Include(x => x.Participants).Where(x => x.EventId == e.Id).OrderBy(x => x.QueuedUtc).ThenBy(x => x.Id).ToListAsync(ct);
        var free = rules.Capacity - applications.SelectMany(x => x.Participants).Count(x => x.SeatStatus is "confirmed" or "reserved");
        foreach (var app in applications.Where(x => x.Participants.Any(p => p.SeatStatus == "waitlisted")))
        {
            var waiting = app.Participants.Where(x => x.SeatStatus == "waitlisted").OrderBy(x => x.Id).ToArray();
            if (app.PolicyVersion != policy.Version && !waiting.All(x => x.IsLegacy)) break;
            var valid = new List<EventRegistrationParticipant>();
            foreach (var person in waiting) if (await MissingAsync(rules, policy, e, app, person, ct) is null) valid.Add(person);
            if (valid.Count != waiting.Length && !app.AllowSplit) break;
            if (!app.AllowSplit && waiting.Length > free) break;
            var promoted = valid.Take(app.AllowSplit ? Math.Max(0, free) : valid.Count).ToArray();
            foreach (var person in promoted) { person.SeatStatus = "confirmed"; free--; }
            if (promoted.Length > 0)
            {
                app.ConcurrencyToken = Guid.NewGuid(); Audit(e.Id, EventDutyAccess.OwnerId(e), "waitlist.promoted", JsonSerializer.Serialize(promoted.Select(x => x.Id)), app.Id);
                Notice(e, app.OrganiserMemberId, EventDutyAccess.OwnerId(e), "event.registration.confirmed", app.Id); await SyncLegacyAsync(app, ct);
            }
            if (free <= 0) break;
        }
        await db.SaveChangesAsync(ct);
    }
    private async Task SyncLegacyAsync(EventRegistrationApplication app, CancellationToken ct)
    {
        if (app.LegacyEnrollmentId is null) return;
        var row = await db.EventEnrollments.FirstOrDefaultAsync(x => x.Id == app.LegacyEnrollmentId && x.EventId == app.EventId, ct);
        if (row is null) return;
        var person = app.Participants.Single(x => x.IsLegacy);
        if (person.SeatStatus == row.Status) return;
        db.EventEnrollmentHistory.Add(new() { Id = Guid.NewGuid(), EnrollmentId = row.Id, Status = row.Status, EnrollmentJson = row.EnrollmentJson, QueuedUtc = row.QueuedUtc, StatusChangedUtc = row.StatusChangedUtc, ArchivedUtc = DateTime.UtcNow });
        row.Status = person.SeatStatus; row.StatusChangedUtc = DateTime.UtcNow; row.UpdatedUtc = DateTime.UtcNow; row.ConcurrencyToken = Guid.NewGuid();
    }
    public async Task ExpireDueAsync(CancellationToken ct)
    {
        var ids = await db.EventRegistrationApplications.AsNoTracking().Where(x => x.ReservationExpiresUtc <= DateTime.UtcNow && x.Participants.Any(p => p.SeatStatus == "reserved")).Select(x => x.EventId).Distinct().Take(100).ToArrayAsync(ct);
        foreach (var id in ids)
        {
            await using var tx = await db.BeginSerializableTransactionAsync(ct); await db.LockEventRegistrationAsync(id, ct);
            var e = await db.GroupEvents.FirstAsync(x => x.Id == id, ct); var policy = await db.EventRegistrationPolicies.FirstAsync(x => x.EventId == id, ct);
            await ReconcileAsync(e, policy, ct); if (tx is not null) await tx.CommitAsync(ct);
        }
    }
}
