using Alife.Application.Common.Models;
using Alife.Application.Pages.Dtos;
using MediatR;

namespace Alife.Application.Admin.Commands.UpdatePagePublicationCopy;

public sealed record UpdatePagePublicationCopyCommand(
    Guid CurrentMemberId,
    Guid PageId,
    IReadOnlyDictionary<string, string> Title,
    IReadOnlyDictionary<string, string>? Description,
    string? TagsJson,
    string? TitleDisplayStyle,
    IReadOnlyList<PageSectionDto> Sections)
    : IRequest<AppResult<PageDetailDto>>;
