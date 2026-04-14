using Alife.Application.Common.Models;
using Alife.Application.Pages.Dtos;
using MediatR;

namespace Alife.Application.Pages.Commands.CreateGroupPage;

public sealed record CreateGroupPageCommand(
    Guid GroupId,
    Guid CurrentMemberId,
    string Title,
    string Slug,
    string Language,
    string? Description,
    string? TagsJson,
    string? TitleDisplayStyle) : IRequest<AppResult<PageDto>>;
