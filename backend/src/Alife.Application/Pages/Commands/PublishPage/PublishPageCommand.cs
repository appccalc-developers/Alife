using Alife.Application.Common.Models;
using Alife.Application.Pages.Dtos;
using Alife.Domain.Enums;
using MediatR;

namespace Alife.Application.Pages.Commands.PublishPage;

public sealed record PublishPageCommand(Guid PageId, Guid CurrentMemberId, PageVisibility Visibility)
    : IRequest<AppResult<PageDto>>;
