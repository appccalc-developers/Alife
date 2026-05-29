using Alife.Application.Abstractions.Security;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Members.Dtos;
using Alife.Domain.Constants;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Members.Commands.UpdateCurrentMemberLanguage;

public sealed class UpdateCurrentMemberLanguageCommandHandler(
	IAlifeDbContext dbContext,
	IJwtTokenService jwtTokenService)
	: IRequestHandler<UpdateCurrentMemberLanguageCommand, AppResult<MemberLanguageUpdateResultDto>>
{
	public async Task<AppResult<MemberLanguageUpdateResultDto>> Handle(
		UpdateCurrentMemberLanguageCommand request,
		CancellationToken cancellationToken)
	{
		var language = MemberLanguage.TryNormalize(request.Language);
		if (language is null)
		{
			return AppResult<MemberLanguageUpdateResultDto>.Validation("Language must be either 'zh' or 'en'.");
		}

		var member = await dbContext.Members.FirstOrDefaultAsync(x => x.Id == request.CurrentMemberId, cancellationToken);
		if (member is null)
		{
			return AppResult<MemberLanguageUpdateResultDto>.NotFound("Current member was not found.");
		}

		member.Language = language;
		member.UpdatedUtc = DateTime.UtcNow;

		await dbContext.SaveChangesAsync(cancellationToken);

		var (token, expiresUtc) = jwtTokenService.CreateToken(member, isGuest: !member.IsRegistered);
		return AppResult<MemberLanguageUpdateResultDto>.Success(new MemberLanguageUpdateResultDto(language, token, expiresUtc));
	}
}