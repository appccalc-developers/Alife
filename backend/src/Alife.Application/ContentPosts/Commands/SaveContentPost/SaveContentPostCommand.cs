using Alife.Application.Common.Models;
using Alife.Application.ContentPosts.Dtos;
using Alife.Domain.Enums;
using MediatR;

namespace Alife.Application.ContentPosts.Commands.SaveContentPost;

public sealed record SaveContentPostCommand(
    Guid? ContentPostId,
    Guid OwnerGroupId,
    Guid CurrentMemberId,
    IReadOnlyDictionary<string, string> Title,
    IReadOnlyDictionary<string, string> Summary,
    IReadOnlyDictionary<string, string> Body,
    ContentPostCategory Category,
    ContentPostVisibility Visibility,
    string? Slug,
    string? CoverImageUrl,
    string? Byline,
    DateTime? PublishedUtc,
    string? SourceUrl,
    string? SourceKey,
    string? SourceChecksum)
    : IRequest<AppResult<ManagedContentPostDto>>;
