using Alife.Application.Common.Models;
using Alife.Application.Pages.Dtos;
using MediatR;

namespace Alife.Application.Pages.Commands.UpdatePage;

public sealed record UpdatePageCommand(
    Guid PageId,
    Guid CurrentMemberId,
    string Title,
    string? Description,
    string? TagsJson,
    string? TitleDisplayStyle) : IRequest<AppResult<PageDto>>;
