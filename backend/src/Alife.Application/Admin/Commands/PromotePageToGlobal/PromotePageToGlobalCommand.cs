using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Admin.Commands.PromotePageToGlobal;

public sealed record PromotePageToGlobalCommand(
    Guid CurrentMemberId,
    Guid PageId,
    IReadOnlyDictionary<string, string>? AccessName)
    : IRequest<AppResult<PageGlobalReviewActionDto>>;
