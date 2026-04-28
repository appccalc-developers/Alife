using Alife.Application.Common.Models;
using Alife.Application.Members.Dtos;
using MediatR;

namespace Alife.Application.Members.Commands.LoginByDisplayName;

public sealed record LoginByDisplayNameCommand(string DisplayName)
    : IRequest<AppResult<MemberActionResultDto>>;
