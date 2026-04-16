namespace Alife.Application.Abstractions.Integrations;

public record LineTokenResult(string LineUID, string? DisplayName, string? Email);

public interface ILineLoginService
{
	string GetAuthorizationUrl(string state);
	Task<LineTokenResult?> ExchangeCodeAsync(string code, CancellationToken cancellationToken = default);
}
