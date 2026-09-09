using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Alife.Application.Groups.Commands.CreateSubgroup;

public sealed class CreateSubgroupCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IGroupCacheInvalidationService groupCacheInvalidationService,
    ICloudflareKvCacheService cloudflareKvCacheService)
    : IRequestHandler<CreateSubgroupCommand, AppResult<GroupDto>>
{
    public async Task<AppResult<GroupDto>> Handle(CreateSubgroupCommand request, CancellationToken cancellationToken)
    {
        var canManage = await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
            request.GroupId,
            request.CurrentMemberId,
            cancellationToken);

        if (!canManage)
        {
            return AppResult<GroupDto>.Forbidden("You do not have permission to create a subgroup.");
        }

        var parentGroup = await dbContext.Groups.FirstOrDefaultAsync(x => x.Id == request.GroupId, cancellationToken);
        if (parentGroup is null)
        {
            return AppResult<GroupDto>.NotFound("Parent group was not found.");
        }

        if (!HasAnyText(request.Name))
        {
            return AppResult<GroupDto>.Validation("Group name is required.");
        }

        if (!Enum.IsDefined(request.GroupType))
        {
            return AppResult<GroupDto>.Validation("Group type must be fellowship or ministry.");
        }

        if (!parentGroup.IsChurch && request.GroupType != GroupType.Ministry)
        {
            return AppResult<GroupDto>.Validation("Only ministry groups can be created under a non-church group.");
        }

        var now = DateTime.UtcNow;
        var subgroup = new Group
        {
            Id = Guid.NewGuid(),
            NameJson = WriteTextMap(request.Name),
            DescriptionJson = request.Description is null ? null : WriteTextMap(request.Description),
            ParentGroupId = request.GroupId,
            AccessType = request.AccessType,
            GroupType = request.GroupType,
            IsChurch = false,
            IsClosed = false,
            CreatedUtc = now,
            UpdatedUtc = now
        };

        dbContext.Groups.Add(subgroup);
        dbContext.GroupMemberships.Add(new GroupMembership
        {
            Id = Guid.NewGuid(),
            GroupId = subgroup.Id,
            MemberId = request.CurrentMemberId,
            Status = MembershipStatus.Approved,
            Role = MembershipRole.Leader,
            CreatedUtc = now,
            UpdatedUtc = now
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        await groupCacheInvalidationService.RemoveSubgroupsAsync(request.GroupId, cancellationToken);
        await cloudflareKvCacheService.PutApprovedMembershipAsync(
            subgroup.Id,
            request.CurrentMemberId,
            MembershipRole.Leader,
            now,
            cancellationToken);
        await cloudflareKvCacheService.RemoveApiCacheKeyAsync($"member:{request.CurrentMemberId}:me", cancellationToken);
        await cloudflareKvCacheService.RemoveMemberProfileAsync(request.CurrentMemberId, cancellationToken);
        await groupCacheInvalidationService.RemoveMembershipsAsync(subgroup.Id, cancellationToken);

        return AppResult<GroupDto>.Success(new GroupDto(
            subgroup.Id,
            ReadTextMap(subgroup.NameJson),
            ReadTextMap(subgroup.DescriptionJson),
            subgroup.ParentGroupId,
            subgroup.AccessType,
            subgroup.IsChurch,
            subgroup.IsClosed,
            subgroup.CreatedUtc,
            subgroup.UpdatedUtc,
            subgroup.GroupType));
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
