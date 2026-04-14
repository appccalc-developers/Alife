using Alife.Application.Auth.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Auth.Commands.CreateGuestSession;

public sealed record CreateGuestSessionCommand() : IRequest<AppResult<AuthSessionDto>>;
