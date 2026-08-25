using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Venues.Queries.ListManagedVenues;

public sealed record ListManagedVenuesQuery(Guid ChurchGroupId, Guid CurrentMemberId)
    : IRequest<AppResult<IReadOnlyList<VenueDto>>>;
