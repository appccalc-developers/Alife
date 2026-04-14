using Alife.Application.Auth.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Auth.Commands.CreateDevAdminSession;

public sealed record CreateDevAdminSessionCommand(bool IsDevelopment) : IRequest<AppResult<AuthSessionDto>>;
