namespace Alife.Application.Events.Dtos;

public sealed record ActivityProjectRules(LocalizedTextDto Eligibility, int? MinimumAge, int? MaximumAge, int Capacity,
    bool AllowWaitlist, bool RequiresGuardianConsent, long FeeMinor, string Currency,
    DateTime OpensUtc, DateTime DeadlineUtc, bool NeedsSpace, LocalizedTextDto Terms, string FeeChargeScope = "perOccurrence");
public sealed record ActivityProjectPolicyDto(Guid Id, int Version, ActivityProjectRules Rules, string ETag, string FeeApprovalStatus);
public sealed record SaveActivityProjectPolicyRequest(ActivityProjectRules Rules);
public sealed record SaveActivityOfferRequest(Guid OccurrenceId, DateTime StartUtc, DateTime EndUtc);
public sealed record ActivitySpaceDto(Guid Id, string Kind, Guid? ReservationId, LocalizedTextDto Name, string Status, string ETag);
public sealed record SaveActivitySpaceRequest(string Kind, Guid? ReservationId, LocalizedTextDto Name, string Status, string? Evidence = null);
public sealed record ActivityOfferDto(Guid Id, string ActivityId, Guid OccurrenceId, DateTime StartUtc, DateTime EndUtc,
    int Capacity, string Status, string ETag, int Confirmed, int Reserved, int Waitlisted, ActivitySpaceDto? Space);
public sealed record ActivityParticipationDto(Guid Id, Guid OfferId, Guid ParticipantId, string DisplayName,
    string SeatStatus, string ProcedureStatus, string Eligibility, long FeeMinor, string Currency,
    long PaidMinor, long RefundedMinor, DateTime? ReservedUntilUtc, string ETag, Guid? ChargeParticipationId = null);
public sealed record ActivityProjectDto(string ActivityId, LocalizedTextDto Name, ActivityProjectPolicyDto? Policy,
    IReadOnlyList<ActivityOfferDto> Offers, IReadOnlyList<ActivityParticipationDto> Participations);
public sealed record ActivityParticipantOptionDto(Guid ParticipantId, string DisplayName, bool IsChild, string SeatStatus,
    bool CanProvidePrivateData = false, bool CanConsent = false, bool CanSelect = false);
public sealed record ActivityOperationsWorkspaceDto(Guid EventId, bool CanManage, bool CanFinance, bool CanApproveFees,
    bool CanManageSpace, IReadOnlyList<ActivityProjectDto> Projects, IReadOnlyList<ActivityParticipantOptionDto> Participants, bool CanConfigure = false);
public sealed record ActivitySelectionRequest(Guid ParticipantId, Guid[] AddOfferIds, Guid[] RemoveParticipationIds);
public sealed record ActivitySelectionPreviewDto(string PreviewToken, ActivitySelectionRequest Change,
    IReadOnlyList<ActivityOfferDto> AddedOffers, long AddedFeeMinor, string Currency, int RefundReviewCount);
public sealed record ApplyActivitySelectionRequest(ActivitySelectionRequest Change, string PreviewToken);
public sealed record ActivityParticipationActionRequest(string? Evidence = null, DateTime? OccurredUtc = null, long? AmountMinor = null,
    Guid? ConsentingMemberId = null);
public sealed record ActivityPrivateDataDto(DateOnly? BirthDate, string ETag);
public sealed record SaveActivityPrivateDataRequest(DateOnly BirthDate, string? Evidence = null);
