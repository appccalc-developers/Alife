using Alife.Application.Common.Models;
using Alife.Application.Pages.Dtos;
using MediatR;

namespace Alife.Application.Pages.Commands.CreateGlobalPage;

public sealed record CreateGlobalPageCommand(
    Guid CurrentMemberId,
    IReadOnlyDictionary<string, string> Title,
    IReadOnlyDictionary<string, string>? Description,
    string? TagsJson,
    string? TitleDisplayStyle,
    IReadOnlyList<PageSectionDto> Sections)
    : IRequest<AppResult<PageDetailDto>>;
