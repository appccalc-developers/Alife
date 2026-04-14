namespace Alife.Application.Abstractions.Integrations;
using Alife.Application.Common.Models;

public interface ITwilioVerifyService
{
	Task<AppResult<bool>> StartVerificationAsync(string phoneE164, CancellationToken cancellationToken = default);
	Task<AppResult<bool>> ConfirmCodeAsync(string phoneE164, string code, CancellationToken cancellationToken = default);
}