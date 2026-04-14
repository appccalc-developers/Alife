using Alife.Application.Common.Models;
using Alife.Application.Sections.Dtos;
using Alife.Domain.Enums;
using MediatR;

namespace Alife.Application.Sections.Commands.ReplaceSectionLinks;

public sealed record ReplaceSectionLinksCommand(Guid SectionId, Guid CurrentMemberId, IReadOnlyList<ReplaceSectionLinkItem> Links)
    : IRequest<AppResult<IReadOnlyList<LinkDto>>>;

public sealed record ReplaceSectionLinkItem(
    LinkType Type,
    Guid? TargetGroupId,
    Guid? TargetPageId,
    string Title,
    string? ImageUrl,
    int SortOrder);
