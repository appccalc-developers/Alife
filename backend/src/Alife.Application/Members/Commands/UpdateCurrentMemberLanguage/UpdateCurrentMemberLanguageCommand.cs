using Alife.Application.Common.Models;
using Alife.Application.Members.Dtos;
using MediatR;

namespace Alife.Application.Members.Commands.UpdateCurrentMemberLanguage;

public sealed record UpdateCurrentMemberLanguageCommand(Guid CurrentMemberId, string Language)
	: IRequest<AppResult<MemberLanguageUpdateResultDto>>;