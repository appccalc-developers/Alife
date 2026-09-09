using System.Net;
using System.Net.Mail;
using System.Text;
using Alife.Application.IdentityAccess;
using Microsoft.Extensions.Configuration;

namespace Alife.Infrastructure.Integrations;

/// <summary>SMTP submission over mandatory STARTTLS; never falls back to plaintext.</summary>
public class SmtpIdentityEmailSender(IConfiguration configuration) : IIdentityEmailSender
{
    private int Port => configuration["IdentityEmail:Smtp:Port"] is not { } port ? 587 :
        int.TryParse(port, out var value) ? value : 0;

    public bool IsAvailable =>
        !string.IsNullOrWhiteSpace(configuration["IdentityEmail:Smtp:Host"]) &&
        Port is > 0 and <= 65535 and not 465 &&
        MailAddress.TryCreate(configuration["IdentityEmail:Sender"], out var sender) &&
        sender.Address == configuration["IdentityEmail:Sender"] &&
        // Leave both unset for a relay that authorizes this deployment by IP.
        (string.IsNullOrEmpty(configuration["IdentityEmail:Smtp:Username"]) ==
         string.IsNullOrEmpty(configuration["IdentityEmail:Smtp:Password"]));

    public async Task<IdentityMessageResult> SendAsync(string recipient, string subject, string body, CancellationToken cancellationToken)
    {
        if (!IsAvailable) return new(false, "email_provider_unavailable");
        try
        {
            using var message = new MailMessage(configuration["IdentityEmail:Sender"]!, recipient)
            {
                Subject = subject, Body = body, IsBodyHtml = false,
                SubjectEncoding = Encoding.UTF8, BodyEncoding = Encoding.UTF8
            };
            using var client = new SmtpClient(configuration["IdentityEmail:Smtp:Host"]!, Port)
            {
                EnableSsl = true,
                UseDefaultCredentials = false,
                DeliveryMethod = SmtpDeliveryMethod.Network
            };
            if (!string.IsNullOrEmpty(configuration["IdentityEmail:Smtp:Username"]))
                client.Credentials = new NetworkCredential(configuration["IdentityEmail:Smtp:Username"], configuration["IdentityEmail:Smtp:Password"]);

            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(TimeSpan.FromSeconds(30));
            await SendMessageAsync(client, message, timeout.Token);
            // Accepted by the submission server, not proof of inbox delivery.
            return new(true);
        }
        catch (Exception exception) when (exception is SmtpException or OperationCanceledException or System.IO.IOException)
        {
            // A lost response can follow acceptance. Never retry automatically or expose server details.
            return new(false, "email_send_unconfirmed");
        }
        catch (Exception exception) when (exception is ArgumentException or FormatException or InvalidOperationException)
        {
            return new(false, "email_send_failed");
        }
    }

    protected virtual Task SendMessageAsync(SmtpClient client, MailMessage message, CancellationToken cancellationToken) =>
        client.SendMailAsync(message, cancellationToken);
}
