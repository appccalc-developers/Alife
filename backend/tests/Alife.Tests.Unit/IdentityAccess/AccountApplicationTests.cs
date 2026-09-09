using Alife.Application.IdentityAccess;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.IdentityAccess;

public sealed partial class IdentityAccessFlowTests
{
    [Fact]
    public async Task ChurchApplicationApproval_IssuesBrowserActivationWithOneChurchGrant()
    {
        await using var f = CreateFixture();
        var a = await SubmitBrowserApplicant(f, "browser");
        foreach (var group in await f.Db.Groups.ToListAsync()) group.IsChurch = group.Id == a.Group;
        f.GroupAuthorization.IsAdminAsync(a.Actor, Arg.Any<CancellationToken>()).Returns(true);
        await f.Db.SaveChangesAsync();
        var result = await f.Service.DecidePersonApplicationAsync(a.Actor, a.Application,
            new(ApplicationDecisionKind.Approved, null, "AA==", IdentityVerified: true), default);
        Assert.True(result.IsSuccess, result.Message);
        Assert.True((await f.Service.GetBrowserApplicationAsync("browser", a.Application, null, default)).Value!.CanActivate);
        Assert.Single(await f.Db.ActivationGroupGrants.ToListAsync());
    }

    [Fact]
    public async Task AccountApplication_RejectsCrossGroupTransferAndElevatedRecoveryWithoutMutation()
    {
        await using var f = CreateFixture();
        var original = await SubmitBrowserApplicant(f, "original");
        var current = await SubmitBrowserApplicant(f, "current");
        var application = await f.Db.GroupMembershipApplications.FindAsync(current.Application);
        application!.Source = "continuationQr";
        await f.Db.SaveChangesAsync();
        Assert.False((await f.Service.DecideGroupApplicationAsync(current.Actor, current.Group, current.Application,
            new(ApplicationDecisionKind.Approved, null, "AA==", IdentityVerified: true, OriginalApplicationId: original.Application), default)).IsSuccess);
        Assert.True((await f.Service.GetBrowserApplicationAsync("original", original.Application, null, default)).IsSuccess);
        Assert.Null(application.BrowserTokenConsumedUtc);
        application.Source = "recoveryQr";
        f.Db.GroupMemberships.Add(new GroupMembership { Id = Guid.NewGuid(), GroupId = current.Group, MemberId = original.Actor, Role = MembershipRole.Leader, Status = MembershipStatus.Approved });
        await f.Db.SaveChangesAsync();
        Assert.False((await f.Service.DecideGroupApplicationAsync(current.Actor, current.Group, current.Application,
            new(ApplicationDecisionKind.Approved, null, "AA==", original.Actor, IdentityVerified: true), default)).IsSuccess);
        Assert.Empty(await f.Db.MemberActivationInvitations.ToListAsync());
        Assert.Equal(MembershipApplicationStatus.Submitted, application.Status);
    }

    [Fact]
    public async Task RecoveryApproval_RechecksAuthorityBeforeCompletion()
    {
        await using var f = CreateFixture();
        var a = await SubmitBrowserApplicant(f, "browser");
        var application = await f.Db.GroupMembershipApplications.FindAsync(a.Application);
        application!.Source = "recoveryQr";
        var target = new Member { Id = Guid.NewGuid(), DisplayName = "Original", IsRegistered = true };
        f.Db.Members.Add(target);
        f.Db.GroupMemberships.Add(new GroupMembership { Id = Guid.NewGuid(), GroupId = a.Group, MemberId = target.Id, Role = MembershipRole.Member, Status = MembershipStatus.Approved });
        await f.Db.SaveChangesAsync();
        Assert.True((await f.Service.DecideGroupApplicationAsync(a.Actor, a.Group, a.Application,
            new(ApplicationDecisionKind.Approved, null, "AA==", target.Id, IdentityVerified: true), default)).IsSuccess);
        var started = await f.Service.StartBrowserActivationAsync("browser", a.Application, default);
        var flow = await f.Service.GetActiveFlowAsync(started.Value!.Token, default);
        f.GroupAuthorization.IsLeaderOrCoLeaderAsync(a.Group, a.Actor, Arg.Any<CancellationToken>()).Returns(false);
        var pending = new MemberPasskeyCredential { Id = Guid.NewGuid(), MemberId = target.Id, CredentialId = [1], PublicKey = [2], UserHandle = [3] };
        f.Db.MemberPasskeyCredentials.Add(pending);
        Assert.False((await f.Service.CompletePasskeyActivationAsync(flow!.Id, pending.Id, default)).IsSuccess);
        Assert.Null(application.BrowserTokenConsumedUtc);
        Assert.Equal(ActivationStatus.Active, (await f.Db.MemberActivationInvitations.SingleAsync()).Status);
    }

    [Fact]
    public async Task RecoveryApplication_BindsOriginalAccountAndBrowserWithoutChangingMemberships()
    {
        await using var f = CreateFixture();
        var a = await SubmitBrowserApplicant(f, "recovery-browser");
        var application = await f.Db.GroupMembershipApplications.FindAsync(a.Application);
        application!.Source = "recoveryQr";
        var member = new Member { Id = Guid.NewGuid(), DisplayName = "Original", IsRegistered = true };
        f.Db.Members.Add(member);
        f.Db.GroupMemberships.Add(new GroupMembership { Id = Guid.NewGuid(), MemberId = member.Id, GroupId = a.Group, Role = MembershipRole.Member, Status = MembershipStatus.Approved });
        var old = new MemberPasskeyCredential { Id = Guid.NewGuid(), MemberId = member.Id, CredentialId = [1], PublicKey = [2], UserHandle = [3] };
        f.Db.MemberPasskeyCredentials.Add(old);
        await f.Db.SaveChangesAsync();
        Assert.False((await f.Service.DecideGroupApplicationAsync(a.Actor, a.Group, a.Application, new(ApplicationDecisionKind.Approved, null, "AA==", member.Id), default)).IsSuccess);
        Assert.True((await f.Service.DecideGroupApplicationAsync(a.Actor, a.Group, a.Application, new(ApplicationDecisionKind.Approved, null, "AA==", member.Id, IdentityVerified: true), default)).IsSuccess);
        Assert.Null(old.RevokedUtc);
        Assert.False((await f.Service.StartBrowserActivationAsync("wrong", a.Application, default)).IsSuccess);
        Assert.True((await f.Service.GetBrowserApplicationAsync("recovery-browser", a.Application, null, default)).Value!.CanActivate);
        var started = await f.Service.StartBrowserActivationAsync("recovery-browser", a.Application, default);
        var flow = await f.Service.GetActiveFlowAsync(started.Value!.Token, default);
        var pending = new MemberPasskeyCredential { Id = Guid.NewGuid(), MemberId = member.Id, CredentialId = [4], PublicKey = [5], UserHandle = [3] };
        f.Db.MemberPasskeyCredentials.Add(pending);
        Assert.True((await f.Service.CompletePasskeyActivationAsync(flow!.Id, pending.Id, default)).IsSuccess);
        Assert.NotNull(old.RevokedUtc);
        Assert.Null(pending.RevokedUtc);
        Assert.Single(await f.Db.GroupMemberships.Where(x => x.MemberId == member.Id).ToListAsync());
        Assert.False((await f.Service.StartBrowserActivationAsync("recovery-browser", a.Application, default)).IsSuccess);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task BrowserTransfer_PreservesApprovalAndDisablesOldReceipt(bool approved)
    {
        await using var f = CreateFixture();
        var a = await SubmitBrowserApplicant(f, "old-browser");
        if (approved) Assert.True((await f.Service.DecideGroupApplicationAsync(a.Actor, a.Group, a.Application, new(ApplicationDecisionKind.Approved, null, "AA==", IdentityVerified: true), default)).IsSuccess);
        var oldFlow = approved ? await f.Service.StartBrowserActivationAsync("old-browser", a.Application, default) : null;
        var invite = await f.Db.GroupJoinInvites.SingleAsync(x => x.GroupId == a.Group);
        var flow = await f.Service.ResolveGroupInviteAsync(invite.Selector, f.TokenService.SignGroupInvite(invite.Selector, invite.Version), false, null, default);
        var current = await f.Service.SubmitGroupApplicationAsync(flow.Value!.Token, null,
            new("Same person", null, "sms", "en", "Continue my application", "v1", true, "", DateTimeOffset.UtcNow.AddSeconds(-5).ToUnixTimeMilliseconds(), "continuation"), default, "new-browser");
        Assert.True(current.IsSuccess);
        var linked = await f.Service.DecideGroupApplicationAsync(a.Actor, a.Group, current.Value!.Id,
            new(ApplicationDecisionKind.Approved, null, "AA==", IdentityVerified: true, OriginalApplicationId: a.Application), default);
        Assert.True(linked.IsSuccess, linked.Message);
        Assert.False((await f.Service.GetBrowserApplicationAsync("old-browser", a.Application, null, default)).IsSuccess);
        var resumed = await f.Service.GetBrowserApplicationAsync("new-browser", current.Value.Id, null, default);
        Assert.Equal(a.Application, resumed.Value!.Application.Id);
        Assert.Equal(approved, resumed.Value.CanActivate);
        Assert.Equal(approved ? "approved" : "submitted", resumed.Value.Application.Status);
        if (oldFlow is not null) Assert.Null(await f.Service.GetActiveFlowAsync(oldFlow.Value!.Token, default));
    }

    [Fact]
    public async Task PendingInvitation_EmailOnly_AcceptanceDoesNotAuthorizeRegistration()
    {
        await using var f = CreateFixture();
        var actor = Guid.NewGuid();
        f.Db.Groups.Add(new Group { Id = Guid.NewGuid(), IsChurch = true, NameJson = "{}" });
        f.GroupAuthorization.IsAdminAsync(actor, Arg.Any<CancellationToken>()).Returns(true);
        await f.Db.SaveChangesAsync();
        var issued = await f.Service.CreateActivationAsync(actor, new("Invited person", "", ActivationPurpose.FirstActivation, [], Email: "person@example.org", ApprovalRequired: true), default);
        Assert.True(issued.IsSuccess, issued.Message);
        var url = new Uri(issued.Value!.ManualActivationMessage!.Message.Split('\n').Last());
        var resolved = await f.Service.ResolveActivationAsync(url.Segments.Last(), url.Fragment[1..], false, null, default);
        Assert.True(resolved.Value!.Context.ApprovalRequired);
        Assert.Null(await f.Service.GetActiveFlowAsync(resolved.Value.Token, default));
        Assert.True((await f.Service.AcceptInvitationAsync(resolved.Value.Token, default)).IsSuccess);
        Assert.False((await f.Db.Members.FindAsync(issued.Value.MemberId))!.IsRegistered);
        Assert.Null(await f.Service.GetActiveFlowAsync(resolved.Value.Token, default));
        var renewed = await f.Service.ResendActivationAsync(actor, issued.Value.Id, default);
        Assert.True(renewed.Value!.ApprovalRequired);
        Assert.False((await f.Service.ApproveInvitationAsync(actor, renewed.Value.Id, false, default)).IsSuccess);
        Assert.True((await f.Service.ApproveInvitationAsync(actor, renewed.Value.Id, true, default)).IsSuccess);
        Assert.False((await f.Service.ResolveActivationAsync(url.Segments.Last(), url.Fragment[1..], false, null, default)).IsSuccess);
    }

    [Fact]
    public async Task DeploymentAdministrator_InitializationIsIdempotentAndRecoveryAllowsHistoricalCredential()
    {
        var id = Guid.NewGuid();
        var mail = Substitute.For<IIdentityEmailSender>();
        mail.IsAvailable.Returns(true);
        mail.SendAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<string>(), Arg.Any<CancellationToken>()).Returns(new IdentityMessageResult(true));
        await using var f = CreateFixture(deploymentAdminId: id, emailSender: mail);
        f.Db.Members.Add(new Member { Id = id, DisplayName = "Administrator", IsRegistered = true });
        f.GroupAuthorization.IsAdminAsync(id, Arg.Any<CancellationToken>()).Returns(true);
        await f.Db.SaveChangesAsync();
        Assert.True((await f.Service.InitializeAdministratorAsync(false, default)).Value);
        Assert.False((await f.Service.InitializeAdministratorAsync(false, default)).Value);
        await mail.Received(1).SendAsync("administrator@nzalc.org", "Activate your ALIFE administrator account", Arg.Any<string>(), Arg.Any<CancellationToken>());
        var old = new MemberPasskeyCredential { Id = Guid.NewGuid(), MemberId = id, CredentialId = [1], PublicKey = [2], UserHandle = [3] };
        f.Db.MemberPasskeyCredentials.Add(old);
        await f.Db.SaveChangesAsync();
        Assert.True((await f.Service.InitializeAdministratorAsync(true, default)).IsSuccess);
        Assert.Null(old.RevokedUtc);
        var body = (string)mail.ReceivedCalls().Last(x => x.GetMethodInfo().Name == "SendAsync").GetArguments()[2]!;
        var url = new Uri(body.Split('\n').Last());
        var resolved = await f.Service.ResolveActivationAsync(url.Segments.Last(), url.Fragment[1..], false, null, default);
        var flow = await f.Service.GetActiveFlowAsync(resolved.Value!.Token, default);
        var pending = new MemberPasskeyCredential { Id = Guid.NewGuid(), MemberId = id, CredentialId = [4], PublicKey = [5], UserHandle = [3] };
        f.Db.MemberPasskeyCredentials.Add(pending);
        Assert.True((await f.Service.CompletePasskeyActivationAsync(flow!.Id, pending.Id, default)).IsSuccess);
        Assert.NotNull(old.RevokedUtc);
        Assert.Null(pending.RevokedUtc);
    }
}
