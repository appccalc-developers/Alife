using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Admin.Commands.ApprovePagePublication;

public sealed record ApprovePagePublicationCommand(
    Guid CurrentMemberId,
    Guid PageId,
    IReadOnlyDictionary<string, string>? PrimaryMenuName,
    IReadOnlyDictionary<string, string>? AccessName,
    IReadOnlyDictionary<string, string>? CardText)
    : IRequest<AppResult<PagePublicationReviewActionDto>>;
