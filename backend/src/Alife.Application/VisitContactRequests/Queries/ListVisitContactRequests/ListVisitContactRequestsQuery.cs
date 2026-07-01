using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Models;
using Alife.Application.VisitContactRequests.Dtos;
using MediatR;

namespace Alife.Application.VisitContactRequests.Queries.ListVisitContactRequests;

public sealed record ListVisitContactRequestsQuery(
    Guid CurrentMemberId,
    string? Search,
    string? Status,
    int Page = 1,
    int PageSize = 25)
    : IRequest<AppResult<AdminPagedResultDto<VisitContactRequestDto>>>;
