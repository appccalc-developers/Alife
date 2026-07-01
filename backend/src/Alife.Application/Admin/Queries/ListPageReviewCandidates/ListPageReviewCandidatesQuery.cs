using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Admin.Queries.ListPageReviewCandidates;

public sealed record ListPageReviewCandidatesQuery(Guid CurrentMemberId)
    : IRequest<AppResult<IReadOnlyList<AdminPageReviewDto>>>;
