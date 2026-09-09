using System.Net;
using System.Text.Json;
using Alife.Infrastructure.Integrations;
using Microsoft.Extensions.Configuration;

namespace Alife.Tests.Unit.IdentityAccess;

public sealed class IdentityEmailTests
{
    [Theory]
    [InlineData(202, true)]
    [InlineData(403, false)]
    [InlineData(429, false)]
    public async Task GraphDelivery_UsesConfiguredMailboxAndReportsAcceptanceOnly(int status, bool sent)
    {
        var requests = new List<(string Url, string Body, string? Authorization)>();
        using var handler = new Handler(async request =>
        {
            requests.Add((request.RequestUri!.ToString(), await request.Content!.ReadAsStringAsync(), request.Headers.Authorization?.ToString()));
            return requests.Count == 1
                ? new(HttpStatusCode.OK) { Content = new StringContent("{\"access_token\":\"test-access-token\"}") }
                : new((HttpStatusCode)status) { Content = new StringContent("private provider detail") };
        });
        using var client = new HttpClient(handler);
        var configuration = Configuration();
        // Existing Graph configuration without Provider must keep working.
        var sender = new ConfiguredIdentityEmailSender(configuration, new SmtpIdentityEmailSender(configuration),
            new Microsoft365IdentityEmailSender(client, configuration));
        Assert.True(sender.IsAvailable);
        var result = await sender.SendAsync("recipient@example.org", "Invitation", "secret link", default);
        Assert.Equal(sent, result.Sent);
        Assert.DoesNotContain("private provider detail", result.ErrorCode ?? "");
        Assert.Equal(2, requests.Count);
        Assert.Contains("/oauth2/v2.0/token", requests[0].Url);
        Assert.Contains("grant_type=client_credentials", requests[0].Body);
        Assert.Contains("/users/alife%40example.org/sendMail", requests[1].Url);
        Assert.Equal("Bearer test-access-token", requests[1].Authorization);
        using var payload = JsonDocument.Parse(requests[1].Body);
        Assert.Equal("recipient@example.org", payload.RootElement.GetProperty("message").GetProperty("toRecipients")[0].GetProperty("emailAddress").GetProperty("address").GetString());
    }

    [Fact]
    public async Task MissingConfiguration_DoesNotAttemptDelivery()
    {
        using var handler = new Handler(_ => throw new InvalidOperationException("Must not send"));
        using var client = new HttpClient(handler);
        var sender = new Microsoft365IdentityEmailSender(client, new ConfigurationBuilder().Build());
        Assert.False(sender.IsAvailable);
        Assert.Equal("email_provider_unavailable", (await sender.SendAsync("recipient@example.org", "Invitation", "secret", default)).ErrorCode);
    }

    private static IConfiguration Configuration() => new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
    {
        ["IdentityEmail:TenantId"] = Guid.NewGuid().ToString(), ["IdentityEmail:ClientId"] = Guid.NewGuid().ToString(),
        ["IdentityEmail:ClientSecret"] = "test-client-secret", ["IdentityEmail:Sender"] = "alife@example.org"
    }).Build();

    private sealed class Handler(Func<HttpRequestMessage, Task<HttpResponseMessage>> send) : HttpMessageHandler
    {
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken) => send(request);
    }
}
