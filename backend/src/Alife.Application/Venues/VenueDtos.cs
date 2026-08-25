using Alife.Domain.Enums;

namespace Alife.Application.Venues;

public sealed record VenueSpaceDto(
    Guid Id,
    IReadOnlyDictionary<string, string> Name,
    int Capacity,
    string ResourcesJson,
    string BookingPolicyJson,
    bool IsActive);

public sealed record VenueDto(
    Guid Id,
    Guid ChurchGroupId,
    IReadOnlyDictionary<string, string> Name,
    IReadOnlyDictionary<string, string> Description,
    IReadOnlyDictionary<string, string> Address,
    string TimeZoneId,
    bool IsActive,
    DateTime UpdatedUtc,
    IReadOnlyList<VenueSpaceDto> Spaces);

public sealed record VenueOccurrenceDto(
    Guid Id,
    IReadOnlyDictionary<string, string> Name,
    DateTime StartUtc,
    DateTime EndUtc,
    string TimeZoneId,
    int SortOrder);

public sealed record VenueBookingDto(
    Guid Id,
    Guid EventId,
    Guid? EventOccurrenceId,
    IReadOnlyDictionary<string, string>? EventOccurrenceName,
    Guid VenueSpaceId,
    Guid VenueId,
    IReadOnlyDictionary<string, string> VenueName,
    IReadOnlyDictionary<string, string> SpaceName,
    IReadOnlyDictionary<string, string> EventTitle,
    IReadOnlyDictionary<string, string> Purpose,
    string Notes,
    string DecisionNotes,
    DateTime StartUtc,
    DateTime EndUtc,
    int AttendeeCount,
    VenueBookingStatus Status,
    Guid RequestedByMemberId,
    string? RequestedByDisplayName,
    Guid? SubmittedByMemberId,
    string? SubmittedByDisplayName,
    Guid? ReviewedByMemberId,
    string? ReviewedByDisplayName,
    DateTime? SubmittedUtc,
    DateTime? ReviewedUtc,
    DateTime UpdatedUtc);

public sealed record EventVenueWorkspaceDto(
    Guid EventId,
    Guid GroupId,
    Guid ChurchGroupId,
    IReadOnlyDictionary<string, string> EventTitle,
    DateTime EventStartUtc,
    DateTime EventEndUtc,
    IReadOnlyList<VenueOccurrenceDto> Occurrences,
    IReadOnlyList<VenueDto> Venues,
    IReadOnlyList<VenueBookingDto> Bookings);
