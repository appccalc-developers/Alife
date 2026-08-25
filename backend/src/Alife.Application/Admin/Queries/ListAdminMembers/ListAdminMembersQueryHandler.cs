using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Admin.Queries.ListAdminMembers;

public sealed class ListAdminMembersQueryHandler(IAlifeDbContext dbContext)
    : IRequestHandler<ListAdminMembersQuery, AppResult<AdminPagedResultDto<AdminMemberDto>>>
{
    public async Task<AppResult<AdminPagedResultDto<AdminMemberDto>>> Handle(
        ListAdminMembersQuery request,
        CancellationToken cancellationToken)
    {
        if (!await AdminPlatformRoleHelpers.HasPermissionAsync(
                dbContext,
                request.CurrentMemberId,
                AdminPermissionCatalog.ViewMembers,
                cancellationToken))
        {
            return AppResult<AdminPagedResultDto<AdminMemberDto>>.Forbidden("You do not have permission to view platform members.");
        }

        var membersQuery = dbContext.Members.AsNoTracking();
        var search = request.Search?.Trim();
        if (!string.IsNullOrWhiteSpace(search))
        {
            membersQuery = membersQuery.Where(member =>
                member.DisplayName != null && member.DisplayName.Contains(search));
        }

        if (request.IsRegistered is bool isRegistered)
        {
            membersQuery = membersQuery.Where(member => member.IsRegistered == isRegistered);
        }

        var roleCode = AdminPlatformRoleHelpers.NormalizeRoleCode(request.Role ?? string.Empty);
        if (!string.IsNullOrWhiteSpace(roleCode))
        {
            membersQuery = membersQuery.Where(member => roleCode == "user"
                ? !member.PlatformRoles.Any(role => role.RevokedUtc == null && role.Role.Code != "user")
                : member.PlatformRoles.Any(role => role.RevokedUtc == null && role.Role.Code == roleCode));
        }

        if (request.ManagementOnly == true)
        {
            membersQuery = membersQuery.Where(member => member.PlatformRoles.Any(role =>
                role.RevokedUtc == null && role.Role.Code != "user"));
        }

        if (request.LeadersOnly == true)
        {
            membersQuery = membersQuery.Where(member => member.Memberships.Any(membership =>
                !membership.Group.IsChurch &&
                membership.Status == MembershipStatus.Approved &&
                membership.Role == MembershipRole.Leader));
        }

        var selectedStatuses = ParseTokens(request.MemberStatuses);
        if (selectedStatuses.Count > 0 && selectedStatuses.Count < 3)
        {
            var includePending = selectedStatuses.Contains("pending");
            var includeActive = selectedStatuses.Contains("active");
            var includeInactive = selectedStatuses.Contains("inactive");
            membersQuery = membersQuery.Where(member =>
                (includePending && member.Memberships.Any(membership =>
                    membership.Group.IsChurch && membership.Status == MembershipStatus.Requested)) ||
                (includeActive && member.Memberships.Any(membership =>
                    membership.Group.IsChurch && membership.Status == MembershipStatus.Approved)) ||
                (includeInactive && !member.Memberships.Any(membership =>
                    membership.Group.IsChurch &&
                    (membership.Status == MembershipStatus.Requested || membership.Status == MembershipStatus.Approved))));
        }

        var selectedGroupIds = ParseGroupIds(request.GroupIds);
        if (selectedGroupIds.Count > 0)
        {
            membersQuery = membersQuery.Where(member => member.Memberships.Any(membership =>
                selectedGroupIds.Contains(membership.GroupId) &&
                !membership.Group.IsChurch &&
                membership.Status == MembershipStatus.Approved));
        }

        var normalizedPage = AdminPaging.NormalizePage(request.Page);
        var normalizedPageSize = AdminPaging.NormalizePageSize(request.PageSize);
        var totalCount = await membersQuery.CountAsync(cancellationToken);
        var totalPages = totalCount == 0 ? 0 : (int)Math.Ceiling(totalCount / (double)normalizedPageSize);

        var pageRows = await membersQuery
            .OrderBy(member => member.DisplayName == null)
            .ThenBy(member => member.DisplayName)
            .ThenBy(member => member.Id)
            .Skip((normalizedPage - 1) * normalizedPageSize)
            .Take(normalizedPageSize)
            .Select(member => new
            {
                member.Id,
                member.DisplayName,
                member.Salutation,
                member.Sex,
                member.Email,
                member.PhoneE164,
                member.IsRegistered,
                member.CreatedUtc,
                member.UpdatedUtc,
                ApprovedGroupCount = member.Memberships.Count(membership =>
                    !membership.Group.IsChurch && membership.Status == MembershipStatus.Approved),
                PendingGroupCount = member.Memberships.Count(membership =>
                    !membership.Group.IsChurch && membership.Status == MembershipStatus.Requested)
            })
            .ToListAsync(cancellationToken);

        var pageMemberIds = pageRows.Select(member => member.Id).ToList();
        var roleRows = await dbContext.MemberPlatformRoles
            .AsNoTracking()
            .Where(role => pageMemberIds.Contains(role.MemberId) && role.RevokedUtc == null)
            .OrderByDescending(role => role.Role.Level)
            .Select(role => new { role.MemberId, role.Role.Code })
            .ToListAsync(cancellationToken);

        var membershipRows = await dbContext.GroupMemberships
            .AsNoTracking()
            .Where(membership => pageMemberIds.Contains(membership.MemberId))
            .Select(membership => new
            {
                membership.MemberId,
                membership.GroupId,
                membership.Group.NameJson,
                membership.Group.IsChurch,
                membership.Status,
                membership.Role,
                membership.UpdatedUtc
            })
            .ToListAsync(cancellationToken);

        var rolesByMember = roleRows
            .GroupBy(role => role.MemberId)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyList<string>)group.Select(role => role.Code).ToList());
        var highestRoleByMember = roleRows
            .GroupBy(role => role.MemberId)
            .ToDictionary(group => group.Key, group => group.Select(role => role.Code).FirstOrDefault());
        var churchMembershipByMember = membershipRows
            .Where(membership => membership.IsChurch)
            .GroupBy(membership => membership.MemberId)
            .ToDictionary(group => group.Key, group => group.OrderByDescending(membership => membership.UpdatedUtc).First());
        var groupsByMember = membershipRows
            .Where(membership => !membership.IsChurch && membership.Status == MembershipStatus.Approved)
            .GroupBy(membership => membership.MemberId)
            .ToDictionary(
                group => group.Key,
                group => (IReadOnlyList<AdminMemberGroupDto>)group
                    .OrderBy(membership => membership.NameJson)
                    .Select(membership => new AdminMemberGroupDto(
                        membership.GroupId,
                        membership.NameJson,
                        membership.Status,
                        membership.Role))
                    .ToList());

        var items = pageRows.Select(member =>
        {
            churchMembershipByMember.TryGetValue(member.Id, out var churchMembership);
            var memberGroups = groupsByMember.TryGetValue(member.Id, out var groups) ? groups : [];
            return new AdminMemberDto(
                member.Id,
                member.DisplayName,
                member.Salutation,
                member.Sex,
                member.Email,
                member.PhoneE164,
                member.IsRegistered,
                false,
                member.CreatedUtc,
                member.UpdatedUtc,
                highestRoleByMember.TryGetValue(member.Id, out var platformRole) && !string.IsNullOrWhiteSpace(platformRole)
                    ? platformRole
                    : "user",
                rolesByMember.TryGetValue(member.Id, out var roles) ? roles : [],
                member.ApprovedGroupCount,
                member.PendingGroupCount,
                churchMembership?.Status,
                churchMembership?.Role,
                memberGroups.Any(group => group.Role == MembershipRole.Leader),
                memberGroups);
        }).ToList();

        return AppResult<AdminPagedResultDto<AdminMemberDto>>.Success(new AdminPagedResultDto<AdminMemberDto>(
            items,
            totalCount,
            normalizedPage,
            normalizedPageSize,
            totalPages));
    }

    private static HashSet<string> ParseTokens(string? value)
        => (value ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(token => token.ToLowerInvariant())
            .Where(token => token is "pending" or "active" or "inactive")
            .ToHashSet(StringComparer.Ordinal);

    private static HashSet<Guid> ParseGroupIds(string? value)
        => (value ?? string.Empty)
            .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(token => Guid.TryParse(token, out var groupId) ? groupId : Guid.Empty)
            .Where(groupId => groupId != Guid.Empty)
            .ToHashSet();
}
