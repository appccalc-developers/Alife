using Alife.Application.Announcements.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Announcements.Queries.ListManagedAnnouncements;

public sealed record ListManagedAnnouncementsQuery(Guid GroupId, Guid CurrentMemberId)
    : IRequest<AppResult<IReadOnlyList<AnnouncementDto>>>;
