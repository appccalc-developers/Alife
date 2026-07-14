using Alife.Application.Announcements.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Announcements.Queries.ListActiveAnnouncements;

public sealed record ListActiveAnnouncementsQuery(Guid GroupId, Guid? CurrentMemberId)
    : IRequest<AppResult<IReadOnlyList<AnnouncementDto>>>;
