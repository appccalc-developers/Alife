using Alife.Application.Common.Models;
using Alife.Application.VisitContactRequests.Commands.CreateVisitContactRequest;
using Alife.Application.VisitContactRequests.Commands.UpdateVisitContactRequestStatus;
using Alife.Application.VisitContactRequests.Queries.ListVisitContactRequests;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Alife.Tests.Unit.VisitContactRequests;

public class CreateVisitContactRequestCommandHandlerTests
{
    [Fact]
    public async Task Create_StoresRequestAndNotifiesVisitorContactReceiver()
    {
        using var dbContext = CreateInMemoryDbContext();
        var receiverId = Guid.NewGuid();
        AddRoleReceiver(dbContext, receiverId);
        await dbContext.SaveChangesAsync();

        var handler = new CreateVisitContactRequestCommandHandler(dbContext);
        var result = await handler.Handle(
            new CreateVisitContactRequestCommand(
                "Visitor",
                "Brother Visitor",
                "visitor@example.com",
                null,
                "zh",
                "I would like to visit this Sunday.",
                "/",
                "127.0.0.1",
                "unit-test",
                PrivacyConsent: true,
                PrivacyConsentVersion: "visitor-v1",
                FormStartedUnixMilliseconds: DateTimeOffset.UtcNow.AddSeconds(-3).ToUnixTimeMilliseconds()),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("Visitor", result.Value?.DisplayName);
        Assert.Equal("new", result.Value?.Status);

        var request = await dbContext.VisitContactRequests.SingleAsync();
        Assert.Equal("visitor@example.com", request.Email);
        Assert.Equal("Brother Visitor", request.Salutation);

        var notification = await dbContext.NotificationMessages.SingleAsync();
        Assert.Equal(receiverId, notification.RecipientMemberId);
        Assert.Equal("visitor.contact.requested", notification.ActionType);
        Assert.Contains(request.Id.ToString(), notification.ActionDataJson);
        Assert.DoesNotContain("Brother Visitor", notification.ActionDataJson);
        Assert.Contains("/admin/visit-requests", notification.ActionDataJson);
        Assert.Empty(dbContext.Members.Where(member => member.Id != receiverId));
    }

    [Theory]
    [InlineData(false, "", -3)]
    [InlineData(true, "bot-value", -3)]
    [InlineData(true, "", 0)]
    public async Task Create_RejectsMissingConsentHoneypotAndTooFastSubmission(
        bool privacyConsent,
        string honeypot,
        int secondsAgo)
    {
        using var dbContext = CreateInMemoryDbContext();
        var handler = new CreateVisitContactRequestCommandHandler(dbContext);

        var result = await handler.Handle(
            new CreateVisitContactRequestCommand(
                "Visitor", null, "visitor@example.com", null, "en",
                "Please contact me.", "/onboarding", null, "unit-test",
                RequestKind: "accessRecovery",
                ReplyPreference: "email",
                PrivacyConsent: privacyConsent,
                PrivacyConsentVersion: "onboarding-v1",
                Honeypot: honeypot,
                FormStartedUnixMilliseconds: DateTimeOffset.UtcNow.AddSeconds(secondsAgo).ToUnixTimeMilliseconds()),
            default);

        Assert.Equal(AppResultStatus.ValidationError, result.Status);
        Assert.Empty(await dbContext.VisitContactRequests.ToListAsync());
        Assert.Empty(await dbContext.Members.ToListAsync());
    }

    [Fact]
    public async Task Create_RequiresEmailOrPhone()
    {
        using var dbContext = CreateInMemoryDbContext();
        var handler = new CreateVisitContactRequestCommandHandler(dbContext);

        var result = await handler.Handle(
            new CreateVisitContactRequestCommand(
                "Visitor",
                null,
                "",
                "",
                "en",
                null,
                "/",
                null,
                null),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(AppResultStatus.ValidationError, result.Status);
        Assert.Empty(dbContext.VisitContactRequests);
        Assert.Empty(dbContext.NotificationMessages);
    }

    [Fact]
    public async Task Create_RejectsInvalidEmail()
    {
        using var dbContext = CreateInMemoryDbContext();
        var handler = new CreateVisitContactRequestCommandHandler(dbContext);

        var result = await handler.Handle(
            new CreateVisitContactRequestCommand(
                "Visitor",
                null,
                "not-an-email",
                null,
                "en",
                null,
                "/",
                null,
                null),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(AppResultStatus.ValidationError, result.Status);
        Assert.Empty(dbContext.VisitContactRequests);
    }

    [Fact]
    public async Task Create_RejectsInvalidPhone()
    {
        using var dbContext = CreateInMemoryDbContext();
        var handler = new CreateVisitContactRequestCommandHandler(dbContext);

        var result = await handler.Handle(
            new CreateVisitContactRequestCommand(
                "Visitor",
                null,
                null,
                "+64abc",
                "en",
                null,
                "/",
                null,
                null),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(AppResultStatus.ValidationError, result.Status);
        Assert.Empty(dbContext.VisitContactRequests);
    }

    [Fact]
    public async Task Create_RequiresMessage()
    {
        using var dbContext = CreateInMemoryDbContext();
        var handler = new CreateVisitContactRequestCommandHandler(dbContext);

        var result = await handler.Handle(
            new CreateVisitContactRequestCommand(
                "Visitor",
                null,
                "visitor@example.com",
                null,
                "en",
                " ",
                "/contact",
                null,
                null,
                PrivacyConsent: true,
                PrivacyConsentVersion: "visitor-v1",
                FormStartedUnixMilliseconds: DateTimeOffset.UtcNow.AddSeconds(-3).ToUnixTimeMilliseconds()),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(AppResultStatus.ValidationError, result.Status);
        Assert.Empty(dbContext.VisitContactRequests);
        Assert.Empty(dbContext.NotificationMessages);
    }

    [Fact]
    public async Task Create_RequiresName()
    {
        using var dbContext = CreateInMemoryDbContext();
        var handler = new CreateVisitContactRequestCommandHandler(dbContext);

        var result = await handler.Handle(
            new CreateVisitContactRequestCommand(
                " ",
                null,
                "visitor@example.com",
                null,
                "en",
                "Please contact me.",
                "/contact",
                null,
                null,
                PrivacyConsent: true,
                PrivacyConsentVersion: "visitor-v1",
                FormStartedUnixMilliseconds: DateTimeOffset.UtcNow.AddSeconds(-3).ToUnixTimeMilliseconds()),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(AppResultStatus.ValidationError, result.Status);
        Assert.Empty(dbContext.VisitContactRequests);
    }

    [Fact]
    public async Task Create_AllowsMissingSalutation()
    {
        using var dbContext = CreateInMemoryDbContext();
        var handler = new CreateVisitContactRequestCommandHandler(dbContext);

        var result = await handler.Handle(
            new CreateVisitContactRequestCommand(
                "Visitor",
                " ",
                "visitor@example.com",
                null,
                "en",
                "Please contact me.",
                "/contact",
                null,
                null,
                PrivacyConsent: true,
                PrivacyConsentVersion: "visitor-v1",
                FormStartedUnixMilliseconds: DateTimeOffset.UtcNow.AddSeconds(-3).ToUnixTimeMilliseconds()),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Null(result.Value?.Salutation);
        Assert.Null((await dbContext.VisitContactRequests.SingleAsync()).Salutation);
    }

    [Fact]
    public async Task Create_StoresValidPhoneRequest()
    {
        using var dbContext = CreateInMemoryDbContext();
        var handler = new CreateVisitContactRequestCommandHandler(dbContext);

        var result = await handler.Handle(
            new CreateVisitContactRequestCommand(
                "Visitor",
                "Sister Anna",
                null,
                "+64211234567",
                "en",
                "Please call me about Sunday service.",
                "/contact",
                null,
                null,
                PrivacyConsent: true,
                PrivacyConsentVersion: "visitor-v1",
                FormStartedUnixMilliseconds: DateTimeOffset.UtcNow.AddSeconds(-3).ToUnixTimeMilliseconds()),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("+64211234567", result.Value?.Phone);
        Assert.Equal("Sister Anna", result.Value?.Salutation);
        Assert.Null(result.Value?.Email);
    }

    [Fact]
    public async Task List_ReturnsRequestsForVisitorContactReceiver()
    {
        using var dbContext = CreateInMemoryDbContext();
        var receiverId = Guid.NewGuid();
        AddRoleReceiver(dbContext, receiverId);
        dbContext.VisitContactRequests.Add(new VisitContactRequest
        {
            Id = Guid.NewGuid(),
            DisplayName = "Visitor",
            Salutation = "Sister Anna",
            Email = "visitor@example.com",
            Status = "new",
            SubmittedUtc = DateTime.UtcNow,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var handler = new ListVisitContactRequestsQueryHandler(dbContext);
        var result = await handler.Handle(
            new ListVisitContactRequestsQuery(receiverId, "Sister Anna", "new"),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value!.Items);
        Assert.Equal("Visitor", result.Value.Items[0].DisplayName);
        Assert.Equal("Sister Anna", result.Value.Items[0].Salutation);
    }

    [Fact]
    public async Task UpdateStatus_MarksRequestContacted()
    {
        using var dbContext = CreateInMemoryDbContext();
        var receiverId = Guid.NewGuid();
        AddRoleReceiver(dbContext, receiverId);
        var requestId = Guid.NewGuid();
        dbContext.VisitContactRequests.Add(new VisitContactRequest
        {
            Id = requestId,
            DisplayName = "Visitor",
            Phone = "021",
            Status = "followUp",
            SubmittedUtc = DateTime.UtcNow,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        await dbContext.SaveChangesAsync();

        var handler = new UpdateVisitContactRequestStatusCommandHandler(dbContext);
        var result = await handler.Handle(
            new UpdateVisitContactRequestStatusCommand(receiverId, requestId, "contacted"),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("contacted", result.Value?.Status);
        Assert.Equal(receiverId, result.Value?.HandledByMemberId);
        Assert.NotNull(result.Value?.HandledUtc);
        Assert.Single(dbContext.AuditLogs);
    }

    private static void AddRoleReceiver(AlifeDbContext dbContext, Guid memberId)
    {
        dbContext.Members.Add(new Member
        {
            Id = memberId,
            DisplayName = "Welcome Team",
            IsRegistered = true,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        dbContext.PlatformRoles.Add(new PlatformRole
        {
            Id = (int)PlatformRoleId.VisitorContactReceiver,
            Code = "visitor_contact_receiver",
            NameJson = "{}",
            PermissionsJson = "[\"admin.access\",\"admin.visitRequests.receive\"]",
            Level = (int)PlatformRoleId.VisitorContactReceiver
        });
        dbContext.MemberPlatformRoles.Add(new MemberPlatformRole
        {
            Id = Guid.NewGuid(),
            MemberId = memberId,
            RoleId = (int)PlatformRoleId.VisitorContactReceiver,
            AssignedUtc = DateTime.UtcNow
        });
    }

    private static AlifeDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }
}
