using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Alife.Application.Groups.Commands.UpdateGroup;

public sealed class UpdateGroupCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IGroupCacheInvalidationService groupCacheInvalidationService)
    : IRequestHandler<UpdateGroupCommand, AppResult<GroupDto>>
{
    public async Task<AppResult<GroupDto>> Handle(UpdateGroupCommand request, CancellationToken cancellationToken)
    {
        var canManage = await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
            request.GroupId,
            request.CurrentMemberId,
            cancellationToken);

        if (!canManage)
        {
            return AppResult<GroupDto>.Forbidden("You do not have permission to update this group.");
        }

        if (!HasAnyText(request.Name))
        {
            return AppResult<GroupDto>.Validation("Group name is required.");
        }

        var group = await dbContext.Groups.FirstOrDefaultAsync(x => x.Id == request.GroupId, cancellationToken);
        if (group is null)
        {
            return AppResult<GroupDto>.NotFound("Group was not found.");
        }

        group.NameJson = WriteTextMap(request.Name);
        group.DescriptionJson = request.Description is null ? null : WriteTextMap(request.Description);
        group.AccessType = request.AccessType;
        group.IsClosed = request.IsClosed;
        group.UpdatedUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);

        await groupCacheInvalidationService.RemoveGroupAsync(group.Id, cancellationToken);
        if (group.IsChurch)
        {
            await groupCacheInvalidationService.RemoveChurchAsync(cancellationToken);
        }

        if (group.ParentGroupId.HasValue)
        {
            await groupCacheInvalidationService.RemoveSubgroupsAsync(group.ParentGroupId.Value, cancellationToken);
        }

        return AppResult<GroupDto>.Success(new GroupDto(
            group.Id,
            ReadTextMap(group.NameJson),
            ReadTextMap(group.DescriptionJson),
            group.ParentGroupId,
            group.AccessType,
            group.IsChurch,
            group.IsClosed,
            group.CreatedUtc,
            group.UpdatedUtc));
    }

    private static bool HasAnyText(IReadOnlyDictionary<string, string> value)
        => value.Values.Any(x => !string.IsNullOrWhiteSpace(x));

    private static string WriteTextMap(IReadOnlyDictionary<string, string> value)
        => JsonSerializer.Serialize(value);

    private static IReadOnlyDictionary<string, string> ReadTextMap(string? value)
        => string.IsNullOrWhiteSpace(value)
            ? new Dictionary<string, string>()
            : JsonSerializer.Deserialize<Dictionary<string, string>>(value) ?? new Dictionary<string, string>();
}
