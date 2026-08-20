using Alife.Application.Common.Models;
using Alife.Application.Members.Dtos;
using MediatR;

namespace Alife.Application.Members.Commands.LoginByAccount;

public sealed record LoginByAccountCommand(string Account, string? Password = null)
    : IRequest<AppResult<MemberActionResultDto>>;
