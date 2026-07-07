using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Admin.Commands.ReturnPagePublication;

public sealed record ReturnPagePublicationCommand(Guid CurrentMemberId, Guid PageId, string Reason)
    : IRequest<AppResult<PagePublicationReviewActionDto>>;
