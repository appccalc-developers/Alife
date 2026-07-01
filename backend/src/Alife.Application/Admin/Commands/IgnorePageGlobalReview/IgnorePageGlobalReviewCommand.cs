using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Admin.Commands.IgnorePageGlobalReview;

public sealed record IgnorePageGlobalReviewCommand(Guid CurrentMemberId, Guid PageId)
    : IRequest<AppResult<PageGlobalReviewActionDto>>;
