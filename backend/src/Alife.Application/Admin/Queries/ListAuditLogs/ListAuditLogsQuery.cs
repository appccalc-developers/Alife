using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Admin.Queries.ListAuditLogs;

public sealed record ListAuditLogsQuery(
    Guid CurrentMemberId,
    string? Search,
    string? Action,
    string? EntityType,
    DateTime? FromUtc,
    DateTime? ToUtc,
    int Page = 1,
    int PageSize = 25)
    : IRequest<AppResult<AdminPagedResultDto<AuditLogDto>>>;
