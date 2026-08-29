using Alife.Application.Common.Models;
using Alife.Application.Members.Dtos;
using MediatR;

namespace Alife.Application.Members.Commands.LineLogin;

public sealed record LineLoginCommand(Guid? CurrentMemberId, string Code, bool IsPublicDevice = false)
    : IRequest<AppResult<MemberActionResultDto>>;
