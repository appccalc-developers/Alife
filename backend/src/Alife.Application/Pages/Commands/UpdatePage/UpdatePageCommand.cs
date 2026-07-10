using Alife.Application.Common.Models;
using Alife.Application.Pages.Dtos;
using MediatR;

namespace Alife.Application.Pages.Commands.UpdatePage;

public sealed record UpdatePageCommand(
    Guid PageId,
    Guid CurrentMemberId,
    IReadOnlyDictionary<string, string> Title,
    IReadOnlyDictionary<string, string>? Description,
    string? TagsJson,
    string? TitleDisplayStyle,
    IReadOnlyList<PageSectionDto> Sections,
    bool PreservePublicationReviewStatus = false) : IRequest<AppResult<PageDetailDto>>;
