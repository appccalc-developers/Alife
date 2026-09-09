using Alife.Application.Common.Models;
using Alife.Application.IdentityAccess;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.IdentityAccess;

public sealed partial class IdentityAccessFlowTests
{
    private static SubmitGroupApplicationRequest PublicApplicationRequest() => new(
        "张三 Alice", null, "email", "zh", "希望参加教会生活", "church-application-v1", true, "",
        DateTimeOffset.UtcNow.AddSeconds(-5).ToUnixTimeMilliseconds(), Sex: "Female", Email: "alice@example.test", NotificationConsent: true);

    private static async Task<(Guid Church, string Flow)> PreparePublicApplication(Fixture fixture)
    {
        var church = new Group { Id = Guid.NewGuid(), IsChurch = true, NameJson = "{\"en\":\"ALIFE\",\"zh\":\"ALIFE\"}" };
        fixture.Db.Groups.Add(church);
        await fixture.Db.SaveChangesAsync();
        var flow = await fixture.Service.CreateFlowAsync(null, false, OnboardingIntent.SignIn, default);
        return (church.Id, flow.Value!.Token);
    }

    [Fact]
    public async Task PublicApplication_EmailOnlyCreatesPendingApplicationWithoutMemberOrPasskey()
    {
        await using var fixture = CreateFixture();
        var setup = await PreparePublicApplication(fixture);
        var result = await fixture.Service.SubmitChurchApplicationAsync(setup.Flow, null, PublicApplicationRequest(), default, "phone-browser");
        Assert.True(result.IsSuccess);
        Assert.Equal("submitted", result.Value!.Status);
        Assert.Equal("submitted", result.Value.PersonStatus);
        Assert.Equal(setup.Church, result.Value.GroupId);
        var application = await fixture.Db.GroupMembershipApplications.SingleAsync();
        var person = await fixture.Db.ChurchPersonApplications.SingleAsync();
        Assert.Null(application.GroupJoinInviteId);
        Assert.Equal("publicChurchApplication", application.Source);
        Assert.NotNull(application.BrowserTokenHash);
        Assert.Equal("Female", person.Sex);
        Assert.Equal("alice@example.test", person.Email);
        Assert.Equal("email", person.ReplyPreference);
        Assert.Equal("church-application-v1", person.NotificationConsentVersion);
        Assert.NotNull(person.NotificationConsentedUtc);
        Assert.Null(person.PhoneE164);
        Assert.False(person.IsContactVerified);
        Assert.False(person.IsIdentityVerified);
        Assert.Empty(fixture.Db.Members);
        Assert.Empty(fixture.Db.MemberPasskeyCredentials);
        Assert.Empty(fixture.Db.MemberActivationInvitations);
        Assert.Empty(fixture.Db.GroupMemberships);
        Assert.Empty(fixture.Db.GroupJoinInvites);
        Assert.Null(result.Value.ManualActivationMessage);
        var resumed = await fixture.Service.GetBrowserApplicationAsync("phone-browser", null, null, default);
        Assert.Equal(application.Id, resumed.Value!.Application.Id);
        Assert.False((await fixture.Service.GetBrowserApplicationAsync("other-browser", null, null, default)).IsSuccess);
    }

    [Theory]
    [InlineData("email")]
    [InlineData("sex")]
    [InlineData("privacy")]
    [InlineData("notification")]
    [InlineData("version")]
    [InlineData("sms")]
    [InlineData("honeypot")]
    [InlineData("fast")]
    [InlineData("intent")]
    public async Task PublicApplication_RejectsIncompleteOrUnconsentedRequests(string invalid)
    {
        await using var fixture = CreateFixture();
        var setup = await PreparePublicApplication(fixture);
        var request = PublicApplicationRequest();
        request = invalid switch
        {
            "email" => request with { Email = "invalid" },
            "sex" => request with { Sex = "unexpected" },
            "privacy" => request with { PrivacyConsent = false },
            "notification" => request with { NotificationConsent = false },
            "version" => request with { PrivacyConsentVersion = "v0" },
            "sms" => request with { ReplyPreference = "sms" },
            "honeypot" => request with { Honeypot = "bot" },
            "intent" => request with { Intent = "recovery" },
            _ => request with { FormStartedUnixMilliseconds = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() }
        };
        var result = await fixture.Service.SubmitChurchApplicationAsync(setup.Flow, null, request, default, "phone-browser");
        Assert.Equal(AppResultStatus.ValidationError, result.Status);
        Assert.Empty(fixture.Db.GroupMembershipApplications);
        Assert.Empty(fixture.Db.Members);
    }

    [Fact]
    public async Task PublicApplication_RequiresLiveFlowAndOpenChurchAndDoesNotBypassGroupInvitation()
    {
        await using var fixture = CreateFixture();
        var setup = await PreparePublicApplication(fixture);
        Assert.False((await fixture.Service.SubmitGroupApplicationAsync(setup.Flow, null, PublicApplicationRequest(), default, "phone-browser")).IsSuccess);
        Assert.False((await fixture.Service.SubmitChurchApplicationAsync("invalid", null, PublicApplicationRequest(), default, "phone-browser")).IsSuccess);
        (await fixture.Db.Groups.SingleAsync()).IsClosed = true;
        await fixture.Db.SaveChangesAsync();
        Assert.Equal("church_application_unavailable", (await fixture.Service.SubmitChurchApplicationAsync(setup.Flow, null, PublicApplicationRequest(), default, "phone-browser")).Message);
        Assert.Empty(fixture.Db.GroupMembershipApplications);
    }

    [Fact]
    public async Task PublicApplication_BrowserReceiptDeduplicatesWithoutMergingNamesOrEmails()
    {
        await using var fixture = CreateFixture();
        var setup = await PreparePublicApplication(fixture);
        var first = await fixture.Service.SubmitChurchApplicationAsync(setup.Flow, null, PublicApplicationRequest(), default, "phone-one");
        var flow = await fixture.Service.CreateFlowAsync(null, false, OnboardingIntent.SignIn, default);
        Assert.Equal("application_already_active", (await fixture.Service.SubmitChurchApplicationAsync(flow.Value!.Token, null, PublicApplicationRequest(), default, "phone-one")).Message);
        Assert.True((await fixture.Service.SubmitChurchApplicationAsync(flow.Value.Token, null, PublicApplicationRequest(), default, "phone-two")).IsSuccess);
        Assert.Equal(2, await fixture.Db.ChurchPersonApplications.CountAsync());
        Assert.False((await fixture.Service.GetBrowserApplicationAsync("phone-two", first.Value!.Id, null, default)).IsSuccess);
    }

    [Fact]
    public async Task PublicApplication_ApprovalRequiresChurchAuthorityAndVerificationThenEnablesPhoneActivation()
    {
        await using var fixture = CreateFixture();
        var setup = await PreparePublicApplication(fixture);
        var submitted = await fixture.Service.SubmitChurchApplicationAsync(setup.Flow, null, PublicApplicationRequest(), default, "phone-browser");
        var id = submitted.Value!.Id;
        var admin = Guid.NewGuid();
        fixture.GroupAuthorization.IsAdminAsync(admin, Arg.Any<CancellationToken>()).Returns(true);
        Assert.False((await fixture.Service.ListPersonApplicationsAsync(Guid.NewGuid(), null, null, null, 1, 20, default)).IsSuccess);
        Assert.False((await fixture.Service.DecidePersonApplicationAsync(Guid.NewGuid(), id, new(ApplicationDecisionKind.Approved, null, "AA==", IdentityVerified: true), default)).IsSuccess);
        Assert.Equal("identity_verification_required", (await fixture.Service.DecidePersonApplicationAsync(admin, id, new(ApplicationDecisionKind.Approved, null, "AA=="), default)).Message);
        Assert.Empty(fixture.Db.Members);
        var approved = await fixture.Service.DecidePersonApplicationAsync(admin, id, new(ApplicationDecisionKind.Approved, null, "AA==", IdentityVerified: true), default);
        Assert.True(approved.IsSuccess);
        Assert.Equal("approved", approved.Value!.Status);
        var member = await fixture.Db.Members.SingleAsync();
        Assert.Equal("Female", member.Sex);
        Assert.Equal("alice@example.test", member.Email);
        Assert.False(member.IsRegistered);
        Assert.Null(member.PhoneVerifiedUtc);
        Assert.Single(await fixture.Db.GroupMemberships.ToListAsync());
        Assert.Single((await fixture.Db.MemberActivationInvitations.Include(x => x.Grants).SingleAsync()).Grants);
        Assert.Equal("alice@example.test", approved.Value.ManualActivationMessage!.RecipientEmail);
        Assert.Equal("email", approved.Value.ManualActivationMessage.ReplyPreference);
        Assert.Contains("/activate/", approved.Value.ManualActivationMessage.Message);
        var queue = await fixture.Service.ListPersonApplicationsAsync(admin, "approved", null, null, 1, 20, default);
        Assert.Null(Assert.Single(queue.Value!.Items).ManualActivationMessage);
        var status = await fixture.Service.GetBrowserApplicationAsync("phone-browser", id, null, default);
        Assert.True(status.Value!.CanActivate);
        Assert.Null(status.Value.Application.ManualActivationMessage);
        Assert.True((await fixture.Service.StartBrowserActivationAsync("phone-browser", id, default)).IsSuccess);
        Assert.False((await fixture.Service.StartBrowserActivationAsync("other-browser", id, default)).IsSuccess);
        var invitation = await fixture.Db.MemberActivationInvitations.SingleAsync();
        Assert.False((await fixture.Service.ResendActivationAsync(Guid.NewGuid(), invitation.Id, default)).IsSuccess);
        var regenerated = await fixture.Service.ResendActivationAsync(admin, invitation.Id, default);
        Assert.True(regenerated.IsSuccess);
        Assert.Equal("alice@example.test", regenerated.Value!.ManualActivationMessage!.RecipientEmail);
        Assert.Equal(ActivationStatus.Revoked, invitation.Status);
        Assert.Equal(id, (await fixture.Db.MemberActivationInvitations.SingleAsync(x => x.Id == regenerated.Value.Id)).SourceApplicationId);
        Assert.True((await fixture.Service.StartBrowserActivationAsync("phone-browser", id, default)).IsSuccess);
        Assert.False((await fixture.Service.DecidePersonApplicationAsync(admin, id, new(ApplicationDecisionKind.Approved, null, "AA==", IdentityVerified: true), default)).IsSuccess);
    }
}
