using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Venues.Commands.SaveVenue;

public sealed record SaveVenueSpaceInput(
    Guid? Id,
    string NameEn,
    string NameZh,
    int Capacity,
    string ResourcesJson,
    string BookingPolicyJson,
    bool IsActive);

public sealed record SaveVenueCommand(
    Guid? VenueId,
    Guid ChurchGroupId,
    Guid CurrentMemberId,
    string NameEn,
    string NameZh,
    string DescriptionEn,
    string DescriptionZh,
    string AddressEn,
    string AddressZh,
    string TimeZoneId,
    bool IsActive,
    IReadOnlyList<SaveVenueSpaceInput> Spaces)
    : IRequest<AppResult<VenueDto>>;
