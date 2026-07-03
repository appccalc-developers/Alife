using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Admin.Commands.RefusePageGlobalReview;

public sealed record RefusePageGlobalReviewCommand(Guid CurrentMemberId, Guid PageId, string Reason)
    : IRequest<AppResult<PageGlobalReviewActionDto>>;
