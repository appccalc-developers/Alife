using System.Net;
using System.Net.Mail;
using System.Net.Sockets;
using Alife.Infrastructure.Integrations;
using Microsoft.Extensions.Configuration;

namespace Alife.Tests.Unit.IdentityAccess;

public sealed class SmtpIdentityEmailTests
{
    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public async Task Submission_UsesTlsUtf8AndConfiguredCredentials(bool authenticate)
    {
        var sender = new InspectingSender(Configuration(authenticate: authenticate), (client, message, ct) =>
        {
            Assert.Equal("smtp.gmail.com", client.Host);
            Assert.Equal(587, client.Port);
            Assert.True(client.EnableSsl);
            Assert.False(client.UseDefaultCredentials);
            Assert.Equal(SmtpDeliveryMethod.Network, client.DeliveryMethod);
            if (authenticate)
            {
                var credential = Assert.IsType<NetworkCredential>(client.Credentials);
                Assert.Equal("sender@gmail.com", credential.UserName);
                Assert.Equal("test-app-password", credential.Password);
            }
            else Assert.Null(client.Credentials);
            Assert.Equal("sender@gmail.com", message.From!.Address);
            Assert.Equal("recipient@example.org", Assert.Single(message.To).Address);
            Assert.Equal("Activate / 激活", message.Subject);
            Assert.Equal("Invite / 邀请 https://example.org/#secret", message.Body);
            Assert.Equal("utf-8", message.BodyEncoding!.WebName);
            Assert.True(ct.CanBeCanceled);
            return Task.CompletedTask;
        });
        Assert.True(sender.IsAvailable);
        Assert.True((await sender.SendAsync("recipient@example.org", "Activate / 激活", "Invite / 邀请 https://example.org/#secret", default)).Sent);
    }

    [Theory]
    [InlineData("IdentityEmail:Smtp:Port", "465")]
    [InlineData("IdentityEmail:Smtp:Port", "invalid")]
    [InlineData("IdentityEmail:Smtp:Port", "65536")]
    [InlineData("IdentityEmail:Smtp:Host", "")]
    [InlineData("IdentityEmail:Sender", "invalid")]
    [InlineData("IdentityEmail:Smtp:Password", "")]
    [InlineData("IdentityEmail:Smtp:Username", "")]
    public async Task InvalidConfiguration_DoesNotSend(string key, string value)
    {
        var config = Configuration();
        config[key] = value;
        var sender = new InspectingSender(config, (_, _, _) => throw new Exception("Must not send"));
        Assert.False(sender.IsAvailable);
        Assert.Equal("email_provider_unavailable", (await sender.SendAsync("recipient@example.org", "Subject", "secret", default)).ErrorCode);
    }

    [Fact]
    public async Task ProviderFailure_AndCancellation_DoNotExposeDetails()
    {
        foreach (var exception in new Exception[] { new SmtpException("private recipient and secret"), new OperationCanceledException("private secret") })
        {
            var sender = new InspectingSender(Configuration(), (_, _, _) => Task.FromException(exception));
            var result = await sender.SendAsync("recipient@example.org", "Subject", "secret", default);
            Assert.False(result.Sent);
            Assert.Equal("email_send_unconfirmed", result.ErrorCode);
        }
    }

    [Theory]
    [InlineData("smtp", true)]
    [InlineData("SMTP", true)]
    [InlineData("microsoft365", false)]
    [InlineData("disabled", false)]
    [InlineData("typo", false)]
    public async Task ProviderSelection_DoesNotFallBackToAnotherProvider(string provider, bool available)
    {
        var config = Configuration();
        config["IdentityEmail:Provider"] = provider;
        using var http = new HttpClient();
        var smtp = new InspectingSender(config, (_, _, _) => Task.CompletedTask);
        var sender = new ConfiguredIdentityEmailSender(config, smtp, new Microsoft365IdentityEmailSender(http, config));
        Assert.Equal(available, sender.IsAvailable);
        Assert.Equal(available, (await sender.SendAsync("recipient@example.org", "Subject", "secret", default)).Sent);
    }

    [Fact]
    public async Task ServerWithoutStartTls_ReceivesNeitherCredentialsNorMessage()
    {
        using var listener = new TcpListener(IPAddress.Loopback, 0);
        listener.Start();
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        var commands = new List<string>();
        var server = Task.Run(async () =>
        {
            using var connection = await listener.AcceptTcpClientAsync(timeout.Token);
            await using var stream = connection.GetStream();
            using var reader = new StreamReader(stream);
            await using var writer = new StreamWriter(stream) { AutoFlush = true, NewLine = "\r\n" };
            await writer.WriteLineAsync("220 localhost test SMTP");
            while (await reader.ReadLineAsync(timeout.Token) is { } line)
            {
                commands.Add(line);
                if (line.StartsWith("EHLO", StringComparison.Ordinal))
                    await writer.WriteLineAsync("250-localhost\r\n250 AUTH LOGIN");
                else if (line == "QUIT") { await writer.WriteLineAsync("221 goodbye"); break; }
                else { await writer.WriteLineAsync("550 rejected"); break; }
            }
        }, timeout.Token);
        var config = Configuration();
        config["IdentityEmail:Smtp:Host"] = "127.0.0.1";
        config["IdentityEmail:Smtp:Port"] = ((IPEndPoint)listener.LocalEndpoint).Port.ToString();
        var sender = new SmtpIdentityEmailSender(config);
        Assert.False((await sender.SendAsync("recipient@example.org", "Subject", "secret", timeout.Token)).Sent);
        await server;
        Assert.Contains(commands, c => c.StartsWith("EHLO", StringComparison.Ordinal));
        Assert.All(commands, c => Assert.True(c.StartsWith("EHLO", StringComparison.Ordinal) || c == "QUIT"));
    }

    private static IConfiguration Configuration(bool authenticate = true) => new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
    {
        ["IdentityEmail:Sender"] = "sender@gmail.com", ["IdentityEmail:Smtp:Host"] = "smtp.gmail.com",
        ["IdentityEmail:Smtp:Username"] = authenticate ? "sender@gmail.com" : null,
        ["IdentityEmail:Smtp:Password"] = authenticate ? "test-app-password" : null
    }).Build();

    private sealed class InspectingSender(IConfiguration configuration, Func<SmtpClient, MailMessage, CancellationToken, Task> send)
        : SmtpIdentityEmailSender(configuration)
    {
        protected override Task SendMessageAsync(SmtpClient client, MailMessage message, CancellationToken cancellationToken) => send(client, message, cancellationToken);
    }
}
