using Alife.Application.Abstractions.Integrations;
using Alife.Application.Common.Models;

namespace Alife.Infrastructure.Integrations;

public class StubTwilioVerifyService : ITwilioVerifyService
{
	public Task<AppResult<bool>> StartVerificationAsync(string phoneE164, CancellationToken cancellationToken = default)
		=> Task.FromResult(AppResult<bool>.Success(true));

	public Task<AppResult<bool>> ConfirmCodeAsync(string phoneE164, string code, CancellationToken cancellationToken = default)
		=> Task.FromResult(code == "000000"
			? AppResult<bool>.Success(true)
			: AppResult<bool>.Validation("Invalid code."));
}