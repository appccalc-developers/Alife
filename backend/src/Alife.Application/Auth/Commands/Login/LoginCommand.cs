using Alife.Application.Auth.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Auth.Commands.Login;

public sealed record LoginCommand(Guid CurrentMemberId) : IRequest<AppResult<AuthSessionDto>>;
