using Alife.Application.Admin.Dtos;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Admin;

internal static class AdminPaging
{
    public static int NormalizePage(int page) => Math.Max(page, 1);

    public static int NormalizePageSize(int pageSize) => Math.Clamp(pageSize, 5, 100);

    public static async Task<AdminPagedResultDto<T>> ToPagedResultAsync<T>(
        IQueryable<T> query,
        int page,
        int pageSize,
        CancellationToken cancellationToken)
    {
        var normalizedPage = NormalizePage(page);
        var normalizedPageSize = NormalizePageSize(pageSize);
        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .Skip((normalizedPage - 1) * normalizedPageSize)
            .Take(normalizedPageSize)
            .ToListAsync(cancellationToken);
        var totalPages = totalCount == 0 ? 0 : (int)Math.Ceiling(totalCount / (double)normalizedPageSize);

        return new AdminPagedResultDto<T>(items, totalCount, normalizedPage, normalizedPageSize, totalPages);
    }
}
