using System.Net;
using System.Net.Mail;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Alife.Application.IdentityAccess;
using Microsoft.Extensions.Configuration;

namespace Alife.Infrastructure.Integrations;

public sealed class Microsoft365IdentityEmailSender(HttpClient client, IConfiguration configuration) : IIdentityEmailSender
{
    public bool IsAvailable => Guid.TryParse(configuration["IdentityEmail:TenantId"], out _) &&
        Guid.TryParse(configuration["IdentityEmail:ClientId"], out _) &&
        !string.IsNullOrWhiteSpace(configuration["IdentityEmail:ClientSecret"]) &&
        MailAddress.TryCreate(configuration["IdentityEmail:Sender"], out var sender) &&
        sender.Address == configuration["IdentityEmail:Sender"];

    public async Task<IdentityMessageResult> SendAsync(string recipient, string subject, string body, CancellationToken cancellationToken)
    {
        if (!IsAvailable) return new(false, "email_provider_unavailable");
        try
        {
            using var tokenContent = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["client_id"] = configuration["IdentityEmail:ClientId"]!,
                ["client_secret"] = configuration["IdentityEmail:ClientSecret"]!,
                ["scope"] = "https://graph.microsoft.com/.default",
                ["grant_type"] = "client_credentials"
            });
            using var tokenResponse = await client.PostAsync($"https://login.microsoftonline.com/{configuration["IdentityEmail:TenantId"]}/oauth2/v2.0/token", tokenContent, cancellationToken);
            if (!tokenResponse.IsSuccessStatusCode) return new(false, "email_authentication_failed");
            using var json = JsonDocument.Parse(await tokenResponse.Content.ReadAsStringAsync(cancellationToken));
            if (!json.RootElement.TryGetProperty("access_token", out var accessToken) || string.IsNullOrEmpty(accessToken.GetString()))
                return new(false, "email_authentication_failed");
            using var message = new HttpRequestMessage(HttpMethod.Post,
                $"https://graph.microsoft.com/v1.0/users/{Uri.EscapeDataString(configuration["IdentityEmail:Sender"]!)}/sendMail");
            message.Headers.Authorization = new AuthenticationHeaderValue("Bearer", accessToken.GetString());
            message.Content = JsonContent.Create(new
            {
                message = new { subject, body = new { contentType = "Text", content = body }, toRecipients = new[] { new { emailAddress = new { address = recipient } } } },
                saveToSentItems = true
            });
            using var response = await client.SendAsync(message, cancellationToken);
            // Accepted means queued by Microsoft 365, not proof of inbox delivery.
            return response.StatusCode == HttpStatusCode.Accepted ? new(true) : new(false, "email_send_failed");
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException or JsonException)
        {
            // Never expose provider response bodies, tokens, recipient addresses or link secrets.
            return new(false, "email_send_unconfirmed");
        }
    }
}
