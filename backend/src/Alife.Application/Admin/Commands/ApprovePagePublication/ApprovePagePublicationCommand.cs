using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Admin.Commands.ApprovePagePublication;

public sealed record ApprovePagePublicationCommand(
    Guid CurrentMemberId,
    Guid PageId,
    IReadOnlyDictionary<string, string>? AccessName)
    : IRequest<AppResult<PagePublicationReviewActionDto>>;
