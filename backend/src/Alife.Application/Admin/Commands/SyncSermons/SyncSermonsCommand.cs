using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Admin.Commands.SyncSermons;

public sealed record SyncSermonsCommand(Guid CurrentMemberId) : IRequest<AppResult<AdminActionResultDto>>;
