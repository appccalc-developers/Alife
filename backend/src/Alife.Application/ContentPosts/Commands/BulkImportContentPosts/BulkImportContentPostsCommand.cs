using Alife.Application.Common.Models;
using Alife.Application.ContentPosts.Dtos;
using MediatR;

namespace Alife.Application.ContentPosts.Commands.BulkImportContentPosts;

public sealed record BulkImportContentPostsCommand(
    Guid GroupId,
    Guid CurrentMemberId,
    bool DryRun,
    bool Publish,
    bool UpdateChanged,
    IReadOnlyList<ContentPostImportItemDto> Items)
    : IRequest<AppResult<ContentPostImportReportDto>>;
