using Alife.Application.Common.Models;
using Alife.Application.Pages.Dtos;
using MediatR;

namespace Alife.Application.Pages.Commands.DeletePage;

public sealed record DeletePageCommand(Guid PageId, Guid CurrentMemberId)
    : IRequest<AppResult<PageActionResultDto>>;
