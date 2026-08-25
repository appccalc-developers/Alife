using Alife.Application.Admin;
using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.VisitContactRequests.Dtos;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.VisitContactRequests.Queries.ListVisitContactRequests;

public sealed class ListVisitContactRequestsQueryHandler(IAlifeDbContext dbContext)
    : IRequestHandler<ListVisitContactRequestsQuery, AppResult<AdminPagedResultDto<VisitContactRequestDto>>>
{
    public async Task<AppResult<AdminPagedResultDto<VisitContactRequestDto>>> Handle(
        ListVisitContactRequestsQuery request,
        CancellationToken cancellationToken)
    {
        if (!await CanAccessAsync(request.CurrentMemberId, cancellationToken))
        {
            return AppResult<AdminPagedResultDto<VisitContactRequestDto>>.Forbidden("You do not have permission to view visitor contact requests.");
        }

        var query = dbContext.VisitContactRequests.AsNoTracking().AsQueryable();

        var search = request.Search?.Trim();
        if (!string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(x =>
                x.DisplayName.Contains(search) ||
                (x.Salutation != null && x.Salutation.Contains(search)) ||
                (x.Email != null && x.Email.Contains(search)) ||
                (x.Phone != null && x.Phone.Contains(search)) ||
                (x.Message != null && x.Message.Contains(search)) ||
                (x.SourcePage != null && x.SourcePage.Contains(search)));
        }

        var status = NormalizeStatus(request.Status);
        if (!string.IsNullOrWhiteSpace(status))
        {
            query = query.Where(x => x.Status == status);
        }

        var dtoQuery = query
            .OrderByDescending(x => x.SubmittedUtc)
            .Select(x => new VisitContactRequestDto(
                x.Id,
                x.DisplayName,
                x.Salutation,
                x.Email,
                x.Phone,
                x.PreferredLanguage,
                x.Message,
                x.SourcePage,
                x.Status,
                x.SubmittedUtc,
                x.HandledUtc,
                x.HandledByMemberId,
                x.HandledByMember == null ? null : x.HandledByMember.DisplayName,
                x.CreatedUtc,
                x.UpdatedUtc));

        var page = await AdminPaging.ToPagedResultAsync(
            dtoQuery,
            request.Page,
            request.PageSize,
            cancellationToken);

        return AppResult<AdminPagedResultDto<VisitContactRequestDto>>.Success(page);
    }

    private async Task<bool> CanAccessAsync(Guid memberId, CancellationToken cancellationToken)
        => await AdminPlatformRoleHelpers.HasPermissionAsync(
            dbContext,
            memberId,
            AdminPermissionCatalog.ReceiveVisitorContactRequests,
            cancellationToken);

    private static string? NormalizeStatus(string? status)
    {
        var normalized = status?.Trim().ToLowerInvariant();
        return normalized switch
        {
            "new" => "new",
            "followup" or "follow-up" or "follow_up" => "followUp",
            "contacted" => "contacted",
            _ => null
        };
    }
}
