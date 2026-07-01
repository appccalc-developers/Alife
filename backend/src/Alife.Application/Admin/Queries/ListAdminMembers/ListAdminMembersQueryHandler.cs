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
        if (!await AdminPlatformRoleHelpers.IsPlatformAdminAsync(dbContext, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<AdminPagedResultDto<AdminMemberDto>>.Forbidden("Platform admin access is required.");
        }

        var membersQuery = dbContext.Members.AsNoTracking();
        var search = request.Search?.Trim();
        if (!string.IsNullOrWhiteSpace(search))
        {
            membersQuery = membersQuery.Where(x =>
                (x.DisplayName != null && x.DisplayName.Contains(search)) ||
                (x.Email != null && x.Email.Contains(search)) ||
                (x.PhoneE164 != null && x.PhoneE164.Contains(search)));
        }

        if (request.IsRegistered is bool isRegistered)
        {
            membersQuery = membersQuery.Where(x => x.IsRegistered == isRegistered);
        }

        var roleCode = AdminPlatformRoleHelpers.NormalizeRoleCode(request.Role ?? string.Empty);
        if (!string.IsNullOrWhiteSpace(roleCode))
        {
            membersQuery = roleCode switch
            {
                "superadmin" => membersQuery.Where(x => x.PlatformRoles.Any(role =>
                    role.RevokedUtc == null && role.Role.Code == "superadmin")),
                "admin" => membersQuery.Where(x =>
                    x.PlatformRoles.Any(role => role.RevokedUtc == null && role.Role.Code == "admin")),
                AdminPlatformRoleHelpers.PageReviewerRoleCode => membersQuery.Where(x =>
                    x.PlatformRoles.Any(role => role.RevokedUtc == null && role.Role.Code == AdminPlatformRoleHelpers.PageReviewerRoleCode)),
                "user" => membersQuery.Where(x =>
                    !x.PlatformRoles.Any(role => role.RevokedUtc == null && role.Role.Code != "user")),
                _ => membersQuery
            };
        }

        var normalizedPage = AdminPaging.NormalizePage(request.Page);
        var normalizedPageSize = AdminPaging.NormalizePageSize(request.PageSize);
        var totalCount = await membersQuery.CountAsync(cancellationToken);
        var totalPages = totalCount == 0 ? 0 : (int)Math.Ceiling(totalCount / (double)normalizedPageSize);

        var pageRows = await membersQuery
            .OrderBy(member => member.DisplayName)
            .Skip((normalizedPage - 1) * normalizedPageSize)
            .Take(normalizedPageSize)
            .Select(member => new
            {
                member.Id,
                member.DisplayName,
                member.Email,
                member.PhoneE164,
                member.IsRegistered,
                ApprovedGroupCount = member.Memberships.Count(m => m.Status == MembershipStatus.Approved),
                PendingGroupCount = member.Memberships.Count(m => m.Status == MembershipStatus.Requested)
            })
            .ToListAsync(cancellationToken);

        var pageMemberIds = pageRows.Select(member => member.Id).ToList();
        var roleRows = await dbContext.MemberPlatformRoles
            .AsNoTracking()
            .Where(role => pageMemberIds.Contains(role.MemberId) && role.RevokedUtc == null)
            .OrderByDescending(role => role.Role.Level)
            .Select(role => new
            {
                role.MemberId,
                role.Role.Code
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

        var items = pageRows
            .Select(member => new AdminMemberDto(
                member.Id,
                member.DisplayName,
                member.Email,
                member.PhoneE164,
                member.IsRegistered,
                false,
                highestRoleByMember.TryGetValue(member.Id, out var platformRole) && !string.IsNullOrWhiteSpace(platformRole)
                    ? platformRole
                    : "user",
                rolesByMember.TryGetValue(member.Id, out var roles) ? roles : [],
                member.ApprovedGroupCount,
                member.PendingGroupCount))
            .ToList();

        var members = new AdminPagedResultDto<AdminMemberDto>(
            items,
            totalCount,
            normalizedPage,
            normalizedPageSize,
            totalPages);

        return AppResult<AdminPagedResultDto<AdminMemberDto>>.Success(members);
    }
}
