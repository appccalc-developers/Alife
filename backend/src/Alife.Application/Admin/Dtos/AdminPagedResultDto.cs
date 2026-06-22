namespace Alife.Application.Admin.Dtos;

public sealed record AdminPagedResultDto<T>(
    IReadOnlyList<T> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages);
