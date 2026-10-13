using System.Text.Json;
using Alife.Application.Common.Models;
using Alife.Application.Common.Interfaces;
using Alife.Application.Events.Dtos;
using Alife.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public sealed partial class EventActivityOperationsService
{
    private sealed record ConsentProof(string ScopeHash, string Evidence);
    private static async Task<string?> ConsentScope(IAlifeDbContext db, EventActivityParticipation row, CancellationToken ct)
    {
        var source = await EventActivityPlanService.ReadAsync(db, row.Offer.EventId, ct);
        var activity = source?.Data.Activities.FirstOrDefault(a => a.Id == row.Offer.ActivityId);
        return activity is null ? null : Hash(new { row.Id, row.ParticipantId, row.OfferId, row.Offer.ActivityId, row.Offer.OccurrenceId,
            Attributes = activity.Attributes.Order(StringComparer.Ordinal).ToArray(), activity.Conditions, row.Offer.StartUtc, row.Offer.EndUtc, row.PolicyVersionId });
    }
    private static bool MatchesConsent(string evidence, string scope)
    {
        try { return JsonSerializer.Deserialize<ConsentProof>(evidence, RamEvaluator.Json)?.ScopeHash == scope; }
        catch (JsonException) { return false; }
    }
    public static int AgeAt(DateOnly birth, DateOnly date)
    { var age = date.Year - birth.Year; return birth.AddYears(age) > date ? age - 1 : age; }
    public static DateOnly? EventLocalDate(DateTime utc, string eventDataJson)
    {
        try
        {
            using var data = JsonDocument.Parse(eventDataJson);
            var zone = "Pacific/Auckland";
            if (data.RootElement.TryGetProperty("timeZone", out var value))
            { if (value.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(value.GetString())) return null; zone = value.GetString()!; }
            if (!TimeZoneInfo.TryFindSystemTimeZoneById(zone, out var timeZone)) return null;
            return DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(utc, DateTimeKind.Utc), timeZone));
        }
        catch (JsonException) { return null; }
    }
    private static DateOnly? LocalDate(DateTime utc, GroupEvent e) => EventLocalDate(utc, e.EventDataJson);
    private async Task<EventRegistrationParticipant?> Person(Guid eventId, Guid participantId, CancellationToken ct) =>
        await db.EventRegistrationParticipants.Include(p => p.Application).FirstOrDefaultAsync(p => p.Id == participantId && p.Application.EventId == eventId, ct);
    private async Task<string> Eligibility(EventActivityParticipation row, GroupEvent e, CancellationToken ct)
    {
        var rules = Rules(row.Offer.Policy);
        if (rules.MinimumAge.HasValue || rules.MaximumAge.HasValue)
        {
            var dob = await db.EventParticipantPrivateData.FirstOrDefaultAsync(p => p.ParticipantId == row.ParticipantId, ct);
            if (dob?.BirthDate is null) return "needsBirthDate";
            var localDate = LocalDate(row.Offer.StartUtc, e);
            if (localDate is null) return "needsReview";
            var age = AgeAt(dob.BirthDate.Value, localDate.Value);
            if (age < 18 && !row.Participant.IsChild) return "needsReview";
            if (rules.MinimumAge.HasValue && age < rules.MinimumAge || rules.MaximumAge.HasValue && age > rules.MaximumAge) return "ineligible";
        }
        if ((!string.IsNullOrWhiteSpace(rules.Eligibility.En) || !string.IsNullOrWhiteSpace(rules.Eligibility.Zh)) && !row.EligibilityVerified) return "needsReview";
        return "eligible";
    }
    private static async Task<bool> HasConsent(IAlifeDbContext db, EventActivityParticipation row, CancellationToken ct)
    {
        if (!row.Participant.IsChild) return true;
        var guardians = await db.EventChildGuardianRelationships.Where(g => g.ChildRegistration.RegistrationParticipantId == row.ParticipantId && g.ChildRegistration.EventId == row.Participant.Application.EventId && g.ChildRegistration.IsActive && g.Status == Alife.Domain.Enums.EventGuardianRelationshipStatus.Confirmed).Select(g => g.GuardianMemberId).ToArrayAsync(ct);
        if (guardians.Length == 0) return false;
        var source = await EventActivityPlanService.ReadAsync(db, row.Offer.EventId, ct);
        var activity = source?.Data.Activities.FirstOrDefault(a => a.Id == row.Offer.ActivityId);
        var required = Rules(row.Offer.Policy).RequiresGuardianConsent || activity?.Attributes.Any(a => a is "hiking" or "water" or "camp") == true;
        if (!required) return true;
        var scope = await ConsentScope(db, row, ct); if (scope is null) return false;
        var records = await db.EventActivityConsents.AsNoTracking().Where(c => c.ParticipationId == row.Id && c.PolicyVersionId == row.PolicyVersionId && (c.Method == "guardianOffline" || c.Method == "guardianOnline") && guardians.Contains(c.ActorMemberId)).ToArrayAsync(ct);
        return records.Any(c => MatchesConsent(c.Evidence, scope));
    }

    private static async Task<bool> ChildProjectAllowed(IAlifeDbContext db, GroupEvent e, EventRegistrationParticipant person, EventActivityOffer offer, CancellationToken ct)
    {
        if (!person.IsChild) return true;
        var source = await EventActivityPlanService.ReadAsync(db, e.Id, ct);
        var activity = source?.Data.Activities.FirstOrDefault(a => a.Id == offer.ActivityId);
        if (activity?.Answers is not { } answers || !answers.TryGetValue("minorsParticipate", out var minors) || minors.Value != "yes" || !minors.Confirmed ||
            !await EventWorkAccess.EnabledAsync(db, e.Id, "SAFEGUARDING.CHILD", ct)) return false;
        var child = await db.EventChildRegistrations.AsNoTracking().FirstOrDefaultAsync(c => c.EventId == e.Id && c.RegistrationParticipantId == person.Id && c.IsActive, ct);
        var config = await db.EventSafeguardingConfigurations.AsNoTracking().Include(c => c.PolicyVersion).FirstOrDefaultAsync(c => c.EventId == e.Id, ct);
        if (child is null || config is null) return false;
        if (!config.PolicyVersion.IsPublished || config.PolicyVersion.EffectiveFromUtc > DateTime.UtcNow || config.PolicyVersion.RetiredUtc <= DateTime.UtcNow) return false;
        var guardians = await db.EventChildGuardianRelationships.AsNoTracking().Where(g => g.ChildRegistrationId == child.Id && g.Status == Alife.Domain.Enums.EventGuardianRelationshipStatus.Confirmed).ToArrayAsync(ct);
        var consents = await db.EventChildConsentRecords.AsNoTracking().Where(c => c.ChildRegistrationId == child.Id && c.PolicyVersionId == config.PolicyVersionId).ToArrayAsync(ct);
        return guardians.Any(g => consents.Where(c => c.GuardianRelationshipId == g.Id).OrderByDescending(c => c.RecordedUtc).ThenByDescending(c => c.Id).FirstOrDefault()?.Decision == Alife.Domain.Enums.EventGuardianConsentDecision.Granted);
    }

    private async Task<AppResult<ActivitySelectionPreviewDto>> Preview(Guid eventId, Guid actor, ActivitySelectionRequest request, CancellationToken ct)
    {
        if (request.AddOfferIds is null || request.RemoveParticipationIds is null || request.AddOfferIds.Length + request.RemoveParticipationIds.Length > 100 || request.AddOfferIds.Distinct().Count() != request.AddOfferIds.Length || request.RemoveParticipationIds.Distinct().Count() != request.RemoveParticipationIds.Length)
            return AppResult<ActivitySelectionPreviewDto>.Validation("Choose unique project occurrences and removals.");
        var e = await db.GroupEvents.FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (e is null) return AppResult<ActivitySelectionPreviewDto>.NotFound("Event not found.");
        var person = await Person(eventId, request.ParticipantId, ct);
        if (person is null) return AppResult<ActivitySelectionPreviewDto>.NotFound("Event participant not found.");
        if (!await Manager(e, actor, ct) && !await ParticipantActor(person, actor, ct)) return AppResult<ActivitySelectionPreviewDto>.Forbidden("Current participant or proxy authority is required.");
        if (person.SeatStatus != "confirmed") return AppResult<ActivitySelectionPreviewDto>.Conflict("Complete Event registration before selecting projects.");
        var added = await db.EventActivityOffers.Include(o => o.Policy).Where(o => o.EventId == eventId && request.AddOfferIds.Contains(o.Id)).ToArrayAsync(ct);
        var remove = await db.EventActivityParticipations.Where(p => p.Offer.EventId == eventId && p.ParticipantId == person.Id && request.RemoveParticipationIds.Contains(p.Id)).ToArrayAsync(ct);
        if (added.Length != request.AddOfferIds.Length || remove.Length != request.RemoveParticipationIds.Length) return AppResult<ActivitySelectionPreviewDto>.Validation("Selections must belong to this Event and participant.");
        if (added.Length > 0 && (!await EventFirstEnabled(e, ct) || e.RegistrationStatus != Alife.Domain.Enums.EventRegistrationStatus.Open || !await Approved(e, ct))) return AppResult<ActivitySelectionPreviewDto>.Conflict("Current approved Event registration must be open before selecting projects.");
        if (added.Length > 0 && !await CurrencyConsistent(eventId, added, ct)) return AppResult<ActivitySelectionPreviewDto>.Conflict("All project fees must use the Event registration currency.");
        foreach (var offer in added)
        {
            if (!await ChildProjectAllowed(db, e, person, offer, ct)) return AppResult<ActivitySelectionPreviewDto>.Conflict("Confirm this project's minor participation and current child safeguarding consent before selecting it for a child.");
            var rules = Rules(offer.Policy);
            if (offer.Status != "open" || rules.OpensUtc > DateTime.UtcNow || rules.DeadlineUtc < DateTime.UtcNow || offer.EndUtc <= DateTime.UtcNow || !await ValidActivity(eventId, offer.ActivityId, offer.OccurrenceId, ct)) return AppResult<ActivitySelectionPreviewDto>.Conflict("A selected project occurrence is not available.");
            if (await db.EventActivityParticipations.AnyAsync(p => p.ParticipantId == person.Id && p.OfferId == offer.Id && p.SeatStatus != "cancelled" && p.SeatStatus != "expired" && !request.RemoveParticipationIds.Contains(p.Id), ct)) return AppResult<ActivitySelectionPreviewDto>.Conflict("This participant already selected the project occurrence.");
        }
        var occupants = await db.EventActivityParticipations.AsNoTracking().Where(p => request.AddOfferIds.Contains(p.OfferId)).OrderBy(p => p.Id).Select(p => new { p.Id, p.ConcurrencyToken }).ToArrayAsync(ct);
        var history = await db.EventActivityParticipations.AsNoTracking().Where(p => p.ParticipantId == person.Id).OrderBy(p => p.Id).ToArrayAsync(ct);
        var chargeIds = history.Select(p => p.ChargeParticipationId ?? p.Id).ToArray();
        var money = await db.EventActivityPayments.AsNoTracking().Where(p => chargeIds.Contains(p.ParticipationId)).ToArrayAsync(ct);
        var quote = await Quote(person.Id, added, request.RemoveParticipationIds, ct);
        var source = await EventActivityPlanService.ReadAsync(db, eventId, ct);
        var token = Hash(new { eventId, actor, request, person.Application.ConcurrencyToken, person.SeatStatus, source = source?.ETag,
            offers = added.OrderBy(o => o.Id).Select(o => new { o.Id, o.ConcurrencyToken, policy = o.Policy.ConcurrencyToken }),
            quotes = quote.OrderBy(q => q.Key).Select(q => new { offerId = q.Key, q.Value.FeeMinor, q.Value.FeePolicyVersionId, q.Value.ExistingChargeId, q.Value.NewChargeOfferId }),
            removals = remove.OrderBy(p => p.Id).Select(p => new { p.Id, p.ConcurrencyToken }), occupants, history = history.Select(p => new { p.Id, p.ConcurrencyToken, p.FeePolicyVersionId }),
            payments = money.OrderBy(p => p.Id).Select(p => p.Id) });
        var all = await db.EventActivityParticipations.AsNoTracking().Where(p => request.AddOfferIds.Contains(p.OfferId)).ToArrayAsync(ct);
        var spaces = await db.EventActivitySpaceRequests.AsNoTracking().Where(s => request.AddOfferIds.Contains(s.OfferId)).ToArrayAsync(ct);
        return AppResult<ActivitySelectionPreviewDto>.Success(new(token, request, added.Select(o => OfferDto(o, all, spaces)).ToArray(),
            quote.Values.Sum(q => q.FeeMinor), added.FirstOrDefault() is { } first ? Rules(first.Policy).Currency : "NZD",
            remove.Count(p => money.Where(m => m.ParticipationId == (p.ChargeParticipationId ?? p.Id) && m.Operation == "payment").Sum(m => m.AmountMinor) > money.Where(m => m.ParticipationId == (p.ChargeParticipationId ?? p.Id) && m.Operation == "refund").Sum(m => m.AmountMinor))));
    }
    public Task<AppResult<ActivitySelectionPreviewDto>> PreviewSelectionAsync(Guid eventId, Guid actor, ActivitySelectionRequest request, CancellationToken ct) => Preview(eventId, actor, request, ct);
    public async Task<AppResult<ActivityOperationsWorkspaceDto>> ApplySelectionAsync(Guid eventId, Guid actor, ApplyActivitySelectionRequest request, string? key, CancellationToken ct)
    {
        await using var tx = await db.BeginSerializableTransactionAsync(ct); await db.LockEventRegistrationAsync(eventId, ct);
        var e = await db.GroupEvents.FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (e is null) return AppResult<ActivityOperationsWorkspaceDto>.NotFound("Event not found.");
        var person = await Person(eventId, request.Change.ParticipantId, ct);
        if (person is null || !await Manager(e, actor, ct) && !await ParticipantActor(person, actor, ct)) return AppResult<ActivityOperationsWorkspaceDto>.Forbidden("Current participant authority is required.");
        var replay = await Replay(eventId, actor, "selection", request, key, ct);
        if (replay is not null) return replay == "replay" ? await GetAsync(eventId, actor, ct) : AppResult<ActivityOperationsWorkspaceDto>.Conflict(replay);
        var preview = await Preview(eventId, actor, request.Change, ct);
        if (!preview.IsSuccess) return AppResult<ActivityOperationsWorkspaceDto>.Conflict(preview.Message!);
        if (preview.Value!.PreviewToken != request.PreviewToken) return AppResult<ActivityOperationsWorkspaceDto>.PreconditionFailed("Project availability or prices changed; review a new preview.");
        foreach (var old in await db.EventActivityParticipations.Where(p => request.Change.RemoveParticipationIds.Contains(p.Id)).ToArrayAsync(ct))
        { old.SeatStatus = "cancelled"; old.ReservedUntilUtc = null; old.ConcurrencyToken = Guid.NewGuid(); }
        var added = await db.EventActivityOffers.Include(o => o.Policy).Where(o => request.Change.AddOfferIds.Contains(o.Id)).ToArrayAsync(ct);
        var quote = await Quote(person.Id, added, request.Change.RemoveParticipationIds, ct);
        // Release the filtered active-participant uniqueness before inserting a replacement history row.
        // The cancellation and replacement still share the serializable transaction.
        await db.SaveChangesAsync(ct);
        var newIds = added.ToDictionary(o => o.Id, _ => Guid.NewGuid());
        foreach (var offer in added)
        {
            var fee = quote[offer.Id];
            db.EventActivityParticipations.Add(new() { Id = newIds[offer.Id], OfferId = offer.Id, ParticipantId = person.Id, PolicyVersionId = offer.PolicyVersionId, FeePolicyVersionId = fee.FeePolicyVersionId,
                ChargeParticipationId = fee.ExistingChargeId ?? (fee.NewChargeOfferId is { } anchor ? newIds[anchor] : null),
                FeeMinor = fee.FeeMinor, Currency = Rules(offer.Policy).Currency, RequestedUtc = DateTime.UtcNow, SeatStatus = person.SeatStatus == "confirmed" ? "draft" : "pendingEvent" });
        }
        Audit(eventId, actor, "selection", person.Id); Remember(eventId, actor, "selection", request, key!, person.Id);
        await NotifyChanged(e, actor, [person.Id], "event.activity.selectionChanged", ct);
        await db.SaveChangesAsync(ct); await ReconcileEventAsync(eventId, ct); if (tx is not null) await tx.CommitAsync(ct); return await GetAsync(eventId, actor, ct);
    }

    public async Task<AppResult<ActivityPrivateDataDto>> GetPrivateDataAsync(Guid eventId, Guid participantId, Guid actor, CancellationToken ct)
    {
        var e = await db.GroupEvents.FirstOrDefaultAsync(x => x.Id == eventId, ct); var person = await Person(eventId, participantId, ct);
        if (e is null || person is null) return AppResult<ActivityPrivateDataDto>.NotFound("Event participant not found.");
        if (!await ParticipantActor(person, actor, ct, proxy: false)) return AppResult<ActivityPrivateDataDto>.Forbidden("Only the person or named guardian may inspect age evidence.");
        var row = await db.EventParticipantPrivateData.AsNoTracking().FirstOrDefaultAsync(p => p.ParticipantId == participantId, ct);
        return AppResult<ActivityPrivateDataDto>.Success(new(row?.BirthDate, row is null ? NewETag : ETag(row.ConcurrencyToken)));
    }
    public async Task<AppResult<ActivityPrivateDataDto>> SavePrivateDataAsync(Guid eventId, Guid participantId, Guid actor, SaveActivityPrivateDataRequest request, string expected, CancellationToken ct)
    {
        await using var tx = await db.BeginSerializableTransactionAsync(ct); await db.LockEventRegistrationAsync(eventId, ct);
        var e = await db.GroupEvents.FirstOrDefaultAsync(x => x.Id == eventId, ct); var person = await Person(eventId, participantId, ct);
        if (e is null || person is null) return AppResult<ActivityPrivateDataDto>.NotFound("Event participant not found.");
        if (!await ParticipantActor(person, actor, ct, proxy: false)) return AppResult<ActivityPrivateDataDto>.Forbidden("Only the person or named guardian may provide birthday.");
        if ((LocalDate(DateTime.UtcNow, e) is not { } today || request.BirthDate > today) || request.BirthDate.Year < 1900 || (request.Evidence?.Length ?? 0) > 2000) return AppResult<ActivityPrivateDataDto>.Validation("Enter a valid past birth date.");
        var row = await db.EventParticipantPrivateData.FirstOrDefaultAsync(p => p.ParticipantId == participantId, ct);
        if (expected != (row is null ? NewETag : ETag(row.ConcurrencyToken))) return AppResult<ActivityPrivateDataDto>.PreconditionFailed("Private age evidence changed.");
        if (row is null) { row = new() { ParticipantId = participantId }; db.EventParticipantPrivateData.Add(row); }
        row.BirthDate = request.BirthDate; row.ProvidedByMemberId = actor; row.UpdatedUtc = DateTime.UtcNow; row.ConcurrencyToken = Guid.NewGuid();
        foreach (var p in await db.EventActivityParticipations.Include(p => p.Offer).ThenInclude(o => o.Policy).Where(p => p.ParticipantId == participantId && p.SeatStatus != "cancelled" && p.SeatStatus != "expired").ToArrayAsync(ct))
            if (Rules(p.Offer.Policy).MinimumAge.HasValue || Rules(p.Offer.Policy).MaximumAge.HasValue) { p.Eligibility = "needsReview"; p.EligibilityVerified = false; p.ProcedureStatus = "reconfirmationRequired"; p.ConcurrencyToken = Guid.NewGuid(); }
        Audit(eventId, actor, "ageEvidence.changed", participantId); await db.SaveChangesAsync(ct); if (tx is not null) await tx.CommitAsync(ct);
        return AppResult<ActivityPrivateDataDto>.Success(new(row.BirthDate, ETag(row.ConcurrencyToken)));
    }

    public async Task<AppResult<ActivityOperationsWorkspaceDto>> ParticipationActionAsync(Guid eventId, Guid participationId, Guid actor, string operation, ActivityParticipationActionRequest request, string expected, string? key, CancellationToken ct)
    {
        if (operation is not ("consent" or "verify-consent" or "verify-eligibility" or "complete" or "cancel" or "payment" or "refund") || (request.Evidence?.Length ?? 0) > 2000) return AppResult<ActivityOperationsWorkspaceDto>.Validation("Unknown project participation action.");
        await using var tx = await db.BeginSerializableTransactionAsync(ct); await db.LockEventRegistrationAsync(eventId, ct);
        var e = await db.GroupEvents.FirstOrDefaultAsync(x => x.Id == eventId, ct);
        var row = await db.EventActivityParticipations.Include(p => p.Offer).ThenInclude(o => o.Policy).Include(p => p.Participant).ThenInclude(p => p.Application).FirstOrDefaultAsync(p => p.Id == participationId && p.Offer.EventId == eventId, ct);
        if (e is null || row is null) return AppResult<ActivityOperationsWorkspaceDto>.NotFound("Project participation not found.");
        var manager = await Manager(e, actor, ct); var finance = await Finance(e, actor, ct); var self = row.Participant.IsChild ? await Guardian(row.Participant, actor, ct) : row.Participant.MemberId == actor;
        if (operation is "payment" or "refund" ? !finance : operation is "verify-consent" or "verify-eligibility" ? !manager : !manager && !await ParticipantActor(row.Participant, actor, ct)) return AppResult<ActivityOperationsWorkspaceDto>.Forbidden("This project action requires its designated authority.");
        var input = new { participationId, operation, request }; var replay = await Replay(eventId, actor, operation, input, key, ct);
        if (replay is not null) return replay == "replay" ? await GetAsync(eventId, actor, ct) : AppResult<ActivityOperationsWorkspaceDto>.Conflict(replay);
        if (expected != ETag(row.ConcurrencyToken)) return AppResult<ActivityOperationsWorkspaceDto>.PreconditionFailed("Project participation changed.");
        if (row.SeatStatus is "cancelled" or "expired" && operation is not ("refund" or "payment")) return AppResult<ActivityOperationsWorkspaceDto>.Conflict("Project participation has ended.");
        switch (operation)
        {
            case "consent":
            case "verify-consent":
                if (operation == "consent" && !self) return AppResult<ActivityOperationsWorkspaceDto>.Forbidden("Adults consent personally; children require their named guardian. Proxy entry is not consent.");
                if (operation == "verify-consent" && (string.IsNullOrWhiteSpace(request.Evidence) || request.OccurredUtc is not { } date || date.Kind != DateTimeKind.Utc || date > DateTime.UtcNow)) return AppResult<ActivityOperationsWorkspaceDto>.Validation("Record the verified person/guardian consent evidence and UTC time.");
                var consentingActor = actor;
                if (operation == "verify-consent" && row.Participant.IsChild)
                {
                    var guardians = await db.EventChildGuardianRelationships.Where(g => g.ChildRegistration.EventId == eventId && g.ChildRegistration.RegistrationParticipantId == row.ParticipantId && g.ChildRegistration.IsActive && g.Status == Alife.Domain.Enums.EventGuardianRelationshipStatus.Confirmed).Select(g => g.GuardianMemberId).Distinct().ToArrayAsync(ct);
                    if (request.ConsentingMemberId is { } named && guardians.Contains(named)) consentingActor = named;
                    else if (request.ConsentingMemberId is null && guardians.Length == 1) consentingActor = guardians[0];
                    else return AppResult<ActivityOperationsWorkspaceDto>.Validation("Choose the confirmed guardian whose offline consent was verified.");
                }
                var scopeHash = await ConsentScope(db, row, ct);
                if (scopeHash is null) return AppResult<ActivityOperationsWorkspaceDto>.Conflict("This project is no longer in the current Event plan.");
                var consentEvidence = JsonSerializer.Serialize(new ConsentProof(scopeHash, request.Evidence ?? ""), new JsonSerializerOptions(RamEvaluator.Json) { Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping });
                if (consentEvidence.Length > 2000) return AppResult<ActivityOperationsWorkspaceDto>.Validation("Consent evidence is too long; use a shorter verification note.");
                db.EventActivityConsents.Add(new() { Id = Guid.NewGuid(), ParticipationId = row.Id, PolicyVersionId = row.PolicyVersionId, ActorMemberId = consentingActor, ConsentedUtc = operation == "consent" ? DateTime.UtcNow : request.OccurredUtc!.Value,
                    Method = row.Participant.IsChild ? operation == "consent" ? "guardianOnline" : "guardianOffline" : operation == "consent" ? "selfOnline" : "selfOffline", Evidence = consentEvidence });
                break;
            case "verify-eligibility":
                if (string.IsNullOrWhiteSpace(request.Evidence)) return AppResult<ActivityOperationsWorkspaceDto>.Validation("Record the eligibility verification basis.");
                row.EligibilityVerified = true;
                break;
            case "complete":
                if (!await EventFirstEnabled(e, ct) || e.RegistrationStatus != Alife.Domain.Enums.EventRegistrationStatus.Open || row.Participant.SeatStatus != "confirmed") return AppResult<ActivityOperationsWorkspaceDto>.Conflict("Confirm Event registration before completing project selection.");
                if (!await ChildProjectAllowed(db, e, row.Participant, row.Offer, ct)) return AppResult<ActivityOperationsWorkspaceDto>.Conflict("Current confirmed minor participation and child safeguarding consent are required.");
                row.Eligibility = await Eligibility(row, e, ct);
                if (row.Eligibility != "eligible") return AppResult<ActivityOperationsWorkspaceDto>.Conflict("Project age or eligibility evidence is incomplete or not satisfied.");
                if (!await HasConsent(db, row, ct)) return AppResult<ActivityOperationsWorkspaceDto>.Conflict("Consent for this project policy version is required.");
                if (row.Offer.Status != "open" || !await Approved(e, ct) || !await SpaceReady(row.Offer, ct) || Rules(row.Offer.Policy).DeadlineUtc < DateTime.UtcNow || Rules(row.Offer.Policy).OpensUtc > DateTime.UtcNow || row.Offer.EndUtc <= DateTime.UtcNow) return AppResult<ActivityOperationsWorkspaceDto>.Conflict("Current project approval, space and registration window are required.");
                var completeRules = Rules(row.Offer.Policy);
                if (!completeRules.AllowWaitlist && row.SeatStatus is not ("confirmed" or "reserved"))
                {
                    var occupied = await db.EventActivityParticipations.CountAsync(p => p.OfferId == row.OfferId && (p.SeatStatus == "confirmed" || p.SeatStatus == "reserved" && p.ReservedUntilUtc > DateTime.UtcNow), ct);
                    if (occupied >= EffectiveCapacity(completeRules)) return AppResult<ActivityOperationsWorkspaceDto>.Conflict("This project occurrence is full and has no waiting list.");
                }
                row.ProcedureStatus = "complete"; row.QueuedUtc ??= DateTime.UtcNow;
                break;
            case "payment":
            case "refund":
                var charge = await Charge(row, ct);
                if (row.Id != charge.Id) return AppResult<ActivityOperationsWorkspaceDto>.Validation("Record payment against the quoted charge participation.");
                var paid = await db.EventActivityPayments.Where(p => p.ParticipationId == charge.Id && p.Operation == "payment").SumAsync(p => p.AmountMinor, ct);
                var refunded = await db.EventActivityPayments.Where(p => p.ParticipationId == charge.Id && p.Operation == "refund").SumAsync(p => p.AmountMinor, ct);
                if (request.AmountMinor is not > 0 || string.IsNullOrWhiteSpace(request.Evidence) || request.AmountMinor > (operation == "payment" ? charge.FeeMinor - paid + refunded : paid - refunded)) return AppResult<ActivityOperationsWorkspaceDto>.Validation("Record a valid outstanding amount and payment/refund evidence.");
                var related = await db.EventActivityParticipations.Include(p => p.Offer).ThenInclude(o => o.Policy).Where(p => p.Id == charge.Id || p.ChargeParticipationId == charge.Id).ToArrayAsync(ct);
                if (operation == "refund" && related.Any(p => p.SeatStatus is not ("cancelled" or "expired"))) return AppResult<ActivityOperationsWorkspaceDto>.Conflict("Cancel all project occurrences covered by this charge before refunding it.");
                var feePolicy = await db.EventActivityPolicyVersions.FirstAsync(p => p.Id == charge.FeePolicyVersionId, ct);
                if (operation == "payment" && (!related.Any(p => p.SeatStatus == "reserved" && p.ReservedUntilUtc > DateTime.UtcNow && p.Offer.Status == "open" && p.ProcedureStatus == "complete") || !await ValidFeeApproval(e, feePolicy, ct) || !await Approved(e, ct))) return AppResult<ActivityOperationsWorkspaceDto>.Conflict("A current reserved project seat and independent fee/Event approvals are required for payment.");
                db.EventActivityPayments.Add(new() { Id = Guid.NewGuid(), ParticipationId = charge.Id, ActorMemberId = actor, Operation = operation, AmountMinor = request.AmountMinor.Value, Evidence = request.Evidence, CreatedUtc = DateTime.UtcNow });
                break;
            case "cancel": row.SeatStatus = "cancelled"; row.ReservedUntilUtc = null; break;
        }
        row.ConcurrencyToken = Guid.NewGuid(); Remember(eventId, actor, operation, input, key!, row.Id); Audit(eventId, actor, operation, row.ParticipantId, request.Evidence);
        if (operation == "cancel") await NotifyChanged(e, actor, [row.ParticipantId], "event.activity.cancelled", ct);
        await db.SaveChangesAsync(ct); await ReconcileEventAsync(eventId, ct); if (tx is not null) await tx.CommitAsync(ct); return await GetAsync(eventId, actor, ct);
    }

    /// <summary>Called inside the registration transaction/lock; never creates identity or changes Event seats.</summary>
    public async Task ReconcileEventAsync(Guid eventId, CancellationToken ct)
    {
        var e = await db.GroupEvents.FirstOrDefaultAsync(x => x.Id == eventId, ct); if (e is null) return;
        var rows = await db.EventActivityParticipations.Include(p => p.Offer).ThenInclude(o => o.Policy).Include(p => p.Participant).ThenInclude(p => p.Application).Where(p => p.Offer.EventId == eventId && p.SeatStatus != "cancelled" && p.SeatStatus != "expired").ToArrayAsync(ct);
        var now = DateTime.UtcNow;
        foreach (var row in rows)
        {
            if (row.Participant.SeatStatus is "cancelled" or "expired") { row.SeatStatus = "cancelled"; row.ReservedUntilUtc = null; row.ConcurrencyToken = Guid.NewGuid(); }
            else if (row.SeatStatus == "reserved" && row.ReservedUntilUtc <= now) { row.SeatStatus = "expired"; row.ReservedUntilUtc = null; row.ConcurrencyToken = Guid.NewGuid(); }
            else if (row.Participant.SeatStatus != "confirmed" && row.SeatStatus is "draft" or "waitlisted") { row.SeatStatus = "pendingEvent"; row.ConcurrencyToken = Guid.NewGuid(); }
        }
        foreach (var group in rows.GroupBy(p => p.OfferId))
        {
            var offer = group.First().Offer; var rules = Rules(offer.Policy);
            if (offer.Status != "open" || offer.EndUtc <= now || rules.OpensUtc > now || rules.DeadlineUtc < now ||
                e.RegistrationStatus != Alife.Domain.Enums.EventRegistrationStatus.Open || !await EventFirstEnabled(e, ct) ||
                !await CurrencyConsistent(eventId, [offer], ct) || !await SpaceReady(offer, ct) || !await Approved(e, ct)) continue;
            var free = EffectiveCapacity(rules) - group.Count(p => p.SeatStatus == "confirmed" || p.SeatStatus == "reserved" && p.ReservedUntilUtc > now);
            foreach (var row in group.Where(p => p.Participant.SeatStatus == "confirmed" && p.ProcedureStatus == "complete" && p.SeatStatus is "draft" or "pendingEvent" or "waitlisted" or "reserved").OrderBy(p => p.QueuedUtc).ThenBy(p => p.Id))
            {
                row.Eligibility = await Eligibility(row, e, ct);
                if (row.Eligibility != "eligible" || !await HasConsent(db, row, ct) || !await ChildProjectAllowed(db, e, row.Participant, offer, ct)) { row.ProcedureStatus = "reconfirmationRequired"; row.ConcurrencyToken = Guid.NewGuid(); continue; }
                var charge = await Charge(row, ct); var netPaid = await NetPaid(charge.Id, ct);
                if (row.SeatStatus == "reserved") { if (netPaid >= charge.FeeMinor) { row.SeatStatus = "confirmed"; row.ReservedUntilUtc = null; row.ConcurrencyToken = Guid.NewGuid(); } continue; }
                if (free <= 0) { var status = rules.AllowWaitlist ? "waitlisted" : "draft"; if (row.SeatStatus != status) { row.SeatStatus = status; row.ConcurrencyToken = Guid.NewGuid(); } continue; }
                row.SeatStatus = charge.FeeMinor > netPaid ? "reserved" : "confirmed";
                row.ReservedUntilUtc = row.SeatStatus == "reserved" ? (now.AddHours(24) < rules.DeadlineUtc ? now.AddHours(24) : rules.DeadlineUtc) : null;
                row.ConcurrencyToken = Guid.NewGuid(); free--;
            }
        }
        await db.SaveChangesAsync(ct);
    }
}
