using Alife.Application.Common.Models;
using Alife.Application.IdentityAccess;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.IdentityAccess;

public sealed partial class IdentityAccessFlowTests
{
    [Fact]
    public async Task BrowserApplication_DeduplicationDoesNotMergePhonelessPeople()
    {
        await using var fixture = CreateFixture();
        var a = await SubmitBrowserApplicant(fixture, "first-browser");
        var invite = await fixture.Db.GroupJoinInvites.SingleAsync(x => x.GroupId == a.Group);
        async Task<Alife.Application.Common.Models.AppResult<MembershipApplicationDto>> Submit(string browser, string? phone)
        {
            var flow = await fixture.Service.ResolveGroupInviteAsync(invite.Selector, fixture.TokenService.SignGroupInvite(invite.Selector, invite.Version), false, null, default);
            return await fixture.Service.SubmitGroupApplicationAsync(flow.Value!.Token, null,
                new("Another applicant", phone, "sms", "en", "I am joining", "v1", true, "", DateTimeOffset.UtcNow.AddSeconds(-5).ToUnixTimeMilliseconds()), default, browser);
        }
        Assert.Equal("application_already_active", (await Submit("first-browser", null)).Message);
        Assert.True((await Submit("second-browser", null)).IsSuccess);
        Assert.Equal("application_invalid", (await Submit("third-browser", "not a phone")).Message);
        Assert.True((await Submit("fourth-browser", "+64210000000")).IsSuccess);
        Assert.Equal("application_already_active", (await Submit("fifth-browser", "+64210000000")).Message);
        Assert.Equal(3, await fixture.Db.GroupMembershipApplications.CountAsync());
        Assert.Equal(3, (await fixture.Db.GroupMembershipApplications.Select(x => x.DeduplicationKey).ToListAsync()).Select(Convert.ToHexString).Distinct().Count());
    }

    [Fact]
    public async Task PersonalRecovery_RechecksElevatedRolesAndLeavesOldCredentialOnFailure()
    {
        await using var fixture = CreateFixture();
        var a = await RecoveryFixture(fixture);
        var invitation = await fixture.Service.IssuePersonalPasskeyAsync(a.Actor, a.Group, a.Member, true, default);
        var url = new Uri(invitation.Value!.Url);
        var resolved = await fixture.Service.ResolveActivationAsync(url.Segments.Last(), url.Fragment[1..], false, null, default);
        var flow = await fixture.Service.GetActiveFlowAsync(resolved.Value!.Token, default);
        fixture.Db.GroupMemberships.Add(new GroupMembership { Id = Guid.NewGuid(), MemberId = a.Member, GroupId = Guid.NewGuid(), Role = MembershipRole.Leader, Status = MembershipStatus.Approved });
        await fixture.Db.SaveChangesAsync();
        var pending = new MemberPasskeyCredential { Id = Guid.NewGuid(), MemberId = a.Member, CredentialId = [9], PublicKey = [8], UserHandle = [3] };
        fixture.Db.MemberPasskeyCredentials.Add(pending);
        Assert.False((await fixture.Service.CompletePasskeyActivationAsync(flow!.Id, pending.Id, default)).IsSuccess);
        Assert.Null((await fixture.Db.MemberPasskeyCredentials.SingleAsync()).RevokedUtc);
    }

    [Fact]
    public async Task PersonalRecovery_ActivePlatformRolesAreProtectedButRevokedRolesAreNot()
    {
        await using var fixture = CreateFixture();
        var a = await RecoveryFixture(fixture);
        var role = new PlatformRole { Id = 9876, Code = "custom-reviewer" };
        var assignment = new MemberPlatformRole { Id = Guid.NewGuid(), MemberId = a.Member, RoleId = role.Id, Role = role };
        fixture.Db.PlatformRoles.Add(role);
        fixture.Db.MemberPlatformRoles.Add(assignment);
        await fixture.Db.SaveChangesAsync();
        Assert.False((await fixture.Service.IssuePersonalPasskeyAsync(a.Actor, a.Group, a.Member, true, default)).IsSuccess);
        assignment.RevokedUtc = DateTime.UtcNow;
        await fixture.Db.SaveChangesAsync();
        Assert.True((await fixture.Service.IssuePersonalPasskeyAsync(a.Actor, a.Group, a.Member, true, default)).IsSuccess);
    }

    private static async Task<(Guid Group, Guid Actor, Guid Application)> SubmitBrowserApplicant(Fixture fixture, string browser, string? phone = null)
    {
        var now = DateTime.UtcNow;
        var group = Guid.NewGuid();
        var actor = Guid.NewGuid();
        if (!await fixture.Db.Groups.AnyAsync(x => x.IsChurch))
            fixture.Db.Groups.Add(new Group { Id = Guid.NewGuid(), IsChurch = true, NameJson = "{}", CreatedUtc = now, UpdatedUtc = now });
        fixture.Db.Groups.Add(new Group { Id = group, NameJson = "{}", CreatedUtc = now, UpdatedUtc = now });
        fixture.Db.Members.Add(new Member { Id = actor, DisplayName = "Leader", IsRegistered = true });
        var invite = NewJoinInvite(group);
        invite.Selector = Guid.NewGuid().ToString("N");
        fixture.Db.GroupJoinInvites.Add(invite);
        fixture.GroupAuthorization.IsLeaderOrCoLeaderAsync(group, actor, Arg.Any<CancellationToken>()).Returns(true);
        await fixture.Db.SaveChangesAsync();
        var flow = await fixture.Service.ResolveGroupInviteAsync(invite.Selector, fixture.TokenService.SignGroupInvite(invite.Selector, invite.Version), false, null, default);
        var submitted = await fixture.Service.SubmitGroupApplicationAsync(flow.Value!.Token, null,
            new("New applicant", phone, "sms", "en", "Joining this group", "v1", true, "", DateTimeOffset.UtcNow.AddSeconds(-5).ToUnixTimeMilliseconds()), default, browser);
        Assert.True(submitted.IsSuccess, submitted.Message);
        return (group, actor, submitted.Value!.Id);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task BrowserApplicant_OptionalPhone_ApprovalAndOneTimeActivation(string? phone)
    {
        await using var fixture = CreateFixture();
        var browser = fixture.TokenService.CreateSecret();
        var (group, actor, id) = await SubmitBrowserApplicant(fixture, browser, phone);
        var person = await fixture.Db.ChurchPersonApplications.SingleAsync();
        Assert.Null(person.PhoneE164);
        Assert.Null(person.PhoneLookupHash);
        Assert.False((await fixture.Service.GetBrowserApplicationAsync("wrong", id, null, default)).IsSuccess);
        Assert.False((await fixture.Service.StartBrowserActivationAsync(browser, id, default)).IsSuccess);
        var approved = await fixture.Service.DecideGroupApplicationAsync(actor, group, id,
            new(ApplicationDecisionKind.Approved, null, "AA==", IdentityVerified: true), default);
        Assert.True(approved.IsSuccess, approved.Message);
        Assert.True(approved.Value!.IsIdentityVerified);
        Assert.False(approved.Value.IsContactVerified);
        Assert.Null(approved.Value.ManualActivationMessage);
        var status = await fixture.Service.GetBrowserApplicationAsync(browser, id, null, default);
        Assert.True(status.Value!.CanActivate);
        var started = await fixture.Service.StartBrowserActivationAsync(browser, id, default);
        Assert.True(started.IsSuccess, started.Message);
        var flow = await fixture.Service.GetActiveFlowAsync(started.Value!.Token, default);
        var pending = new MemberPasskeyCredential { Id = Guid.NewGuid(), MemberId = person.LinkedMemberId!.Value, CredentialId = [1], PublicKey = [2], UserHandle = [3], DisplayName = "Phone" };
        fixture.Db.MemberPasskeyCredentials.Add(pending);
        var completed = await fixture.Service.CompletePasskeyActivationAsync(flow!.Id, pending.Id, default);
        Assert.True(completed.IsSuccess, completed.Message);
        Assert.Null((await fixture.Db.Members.FindAsync(person.LinkedMemberId))!.PhoneVerifiedUtc);
        Assert.False((await fixture.Service.StartBrowserActivationAsync(browser, id, default)).IsSuccess);
        Assert.False((await fixture.Service.CompletePasskeyActivationAsync(flow.Id, pending.Id, default)).IsSuccess);
    }

    [Fact]
    public async Task BrowserApplications_IsolateBrowsersAndGroups_ExpireAndRespectInviteState()
    {
        await using var fixture = CreateFixture();
        var browser = fixture.TokenService.CreateSecret();
        var a = await SubmitBrowserApplicant(fixture, browser);
        var b = await SubmitBrowserApplicant(fixture, browser);
        var c = await SubmitBrowserApplicant(fixture, "another-browser");
        Assert.True((await fixture.Service.GetBrowserApplicationAsync(browser, a.Application, null, default)).IsSuccess);
        Assert.True((await fixture.Service.GetBrowserApplicationAsync(browser, b.Application, null, default)).IsSuccess);
        Assert.False((await fixture.Service.GetBrowserApplicationAsync(browser, c.Application, null, default)).IsSuccess);
        var invite = await fixture.Db.GroupJoinInvites.SingleAsync(x => x.GroupId == a.Group);
        Assert.True((await fixture.Service.GetBrowserApplicationAsync(browser, null, invite.Id, default)).IsSuccess);
        invite.Status = GroupJoinInviteStatus.Paused;
        await fixture.Db.SaveChangesAsync();
        Assert.False((await fixture.Service.GetBrowserApplicationAsync(browser, null, invite.Id, default)).IsSuccess);
        var application = await fixture.Db.GroupMembershipApplications.FindAsync(a.Application);
        application!.BrowserTokenExpiresUtc = DateTime.UtcNow.AddSeconds(-1);
        await fixture.Db.SaveChangesAsync();
        Assert.False((await fixture.Service.GetBrowserApplicationAsync(browser, a.Application, null, default)).IsSuccess);
    }

    [Fact]
    public async Task BrowserApplication_SupplementAndRejectionRemainInBrowser()
    {
        await using var fixture = CreateFixture();
        var browser = fixture.TokenService.CreateSecret();
        var a = await SubmitBrowserApplicant(fixture, browser);
        Assert.True((await fixture.Service.DecideGroupApplicationAsync(a.Actor, a.Group, a.Application,
            new(ApplicationDecisionKind.NeedsInfo, "Please confirm the meeting", "AA=="), default)).IsSuccess);
        Assert.Empty(await fixture.Db.ApplicationResponseTokens.ToListAsync());
        Assert.False((await fixture.Service.SupplementBrowserApplicationAsync("wrong", a.Application, "Confirmed", "AA==", default)).IsSuccess);
        Assert.True((await fixture.Service.SupplementBrowserApplicationAsync(browser, a.Application, "Confirmed", "AA==", default)).IsSuccess);
        Assert.False((await fixture.Service.SupplementBrowserApplicationAsync(browser, a.Application, "Again", "AA==", default)).IsSuccess);
        Assert.True((await fixture.Service.DecideGroupApplicationAsync(a.Actor, a.Group, a.Application,
            new(ApplicationDecisionKind.Rejected, "Internal note", "AA=="), default)).IsSuccess);
        var status = await fixture.Service.GetBrowserApplicationAsync(browser, a.Application, null, default);
        Assert.Equal("rejected", status.Value!.Application.Status);
        Assert.DoesNotContain(status.Value.Application.History, x => x.Note == "Internal note" || x.ActorMemberId is not null);
        Assert.False((await fixture.Service.StartBrowserActivationAsync(browser, a.Application, default)).IsSuccess);
    }

    [Theory]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public async Task BrowserApproval_LinkedRegisteredOrElevatedAccountNeverGetsRecoveryAuthority(bool registered, bool elevated)
    {
        await using var fixture = CreateFixture();
        var a = await SubmitBrowserApplicant(fixture, "browser");
        var existing = new Member { Id = Guid.NewGuid(), IsRegistered = registered, DisplayName = "Existing member" };
        if (elevated) fixture.Db.GroupMemberships.Add(new GroupMembership { Id = Guid.NewGuid(), MemberId = existing.Id, GroupId = Guid.NewGuid(), Role = MembershipRole.Leader, Status = MembershipStatus.Approved });
        fixture.Db.Members.Add(existing);
        await fixture.Db.SaveChangesAsync();
        var approved = await fixture.Service.DecideGroupApplicationAsync(a.Actor, a.Group, a.Application,
            new(ApplicationDecisionKind.Approved, null, "AA==", existing.Id, IdentityVerified: true), default);
        Assert.True(approved.IsSuccess);
        Assert.Empty(await fixture.Db.MemberActivationInvitations.ToListAsync());
        Assert.False((await fixture.Service.GetBrowserApplicationAsync("browser", a.Application, null, default)).Value!.CanActivate);
        Assert.False((await fixture.Service.StartBrowserActivationAsync("browser", a.Application, default)).IsSuccess);
    }

    private static async Task<(Guid Group, Guid Actor, Guid Member)> RecoveryFixture(Fixture fixture)
    {
        var group = Guid.NewGuid(); var actor = Guid.NewGuid(); var member = Guid.NewGuid();
        fixture.Db.Groups.Add(new Group { Id = group, NameJson = "{}" });
        fixture.Db.Members.AddRange(new Member { Id = actor, DisplayName = "Leader", IsRegistered = true }, new Member { Id = member, DisplayName = "Member", IsRegistered = true });
        fixture.Db.GroupMemberships.Add(new GroupMembership { Id = Guid.NewGuid(), GroupId = group, MemberId = member, Role = MembershipRole.Member, Status = MembershipStatus.Approved });
        fixture.GroupAuthorization.IsLeaderOrCoLeaderAsync(group, actor, Arg.Any<CancellationToken>()).Returns(true);
        fixture.Db.MemberPasskeyCredentials.Add(new MemberPasskeyCredential { Id = Guid.NewGuid(), MemberId = member, CredentialId = [1], PublicKey = [2], UserHandle = [3], DisplayName = "Lost phone" });
        await fixture.Db.SaveChangesAsync();
        return (group, actor, member);
    }

    [Fact]
    public async Task PersonalRecovery_PermissionMatrixAndReissue()
    {
        await using var fixture = CreateFixture();
        var a = await RecoveryFixture(fixture);
        Assert.False((await fixture.Service.IssuePersonalPasskeyAsync(a.Actor, a.Group, a.Member, false, default)).IsSuccess);
        Assert.False((await fixture.Service.IssuePersonalPasskeyAsync(a.Member, a.Group, a.Member, true, default)).IsSuccess);
        Assert.False((await fixture.Service.IssuePersonalPasskeyAsync(Guid.NewGuid(), a.Group, a.Member, true, default)).IsSuccess);
        Assert.False((await fixture.Service.IssuePersonalPasskeyAsync(a.Actor, Guid.NewGuid(), a.Member, true, default)).IsSuccess);
        var first = await fixture.Service.IssuePersonalPasskeyAsync(a.Actor, a.Group, a.Member, true, default);
        Assert.True(first.IsSuccess);
        var second = await fixture.Service.IssuePersonalPasskeyAsync(a.Actor, a.Group, a.Member, true, default);
        Assert.True(second.IsSuccess);
        Assert.Equal(ActivationStatus.Revoked, (await fixture.Db.MemberActivationInvitations.FindAsync(first.Value!.Id))!.Status);
        Assert.Null((await fixture.Db.MemberPasskeyCredentials.SingleAsync()).RevokedUtc);
        Assert.True((await fixture.Service.RevokePersonalPasskeyAsync(a.Actor, a.Group, a.Member, second.Value!.Id, default)).IsSuccess);
        fixture.Db.GroupMemberships.Add(new GroupMembership { Id = Guid.NewGuid(), MemberId = a.Member, GroupId = Guid.NewGuid(), Role = MembershipRole.CoLeader, Status = MembershipStatus.Approved });
        await fixture.Db.SaveChangesAsync();
        Assert.False((await fixture.Service.IssuePersonalPasskeyAsync(a.Actor, a.Group, a.Member, true, default)).IsSuccess);
        fixture.GroupAuthorization.IsAdminAsync(a.Actor, Arg.Any<CancellationToken>()).Returns(true);
        Assert.True((await fixture.Service.IssuePersonalPasskeyAsync(a.Actor, a.Group, a.Member, true, default)).IsSuccess);
    }

    [Theory]
    [InlineData(false, false)]
    [InlineData(true, false)]
    [InlineData(false, true)]
    public async Task PersonalRecovery_OnlySuccessfulCompletionRevokesOldCredentials(bool losePermission, bool expire)
    {
        await using var fixture = CreateFixture();
        var a = await RecoveryFixture(fixture);
        var issued = await fixture.Service.IssuePersonalPasskeyAsync(a.Actor, a.Group, a.Member, true, default);
        var invitation = await fixture.Db.MemberActivationInvitations.FindAsync(issued.Value!.Id);
        Assert.Equal(invitation!.CreatedUtc.AddMinutes(10), invitation.ExpiresUtc);
        var url = new Uri(issued.Value.Url);
        var resolved = await fixture.Service.ResolveActivationAsync(url.Segments.Last(), url.Fragment[1..], false, null, default);
        var flow = await fixture.Service.GetActiveFlowAsync(resolved.Value!.Token, default);
        if (losePermission) fixture.GroupAuthorization.IsLeaderOrCoLeaderAsync(a.Group, a.Actor, Arg.Any<CancellationToken>()).Returns(false);
        if (expire) { invitation.ExpiresUtc = DateTime.UtcNow.AddSeconds(-1); await fixture.Db.SaveChangesAsync(); }
        var pending = new MemberPasskeyCredential { Id = Guid.NewGuid(), MemberId = a.Member, CredentialId = [4], PublicKey = [5], UserHandle = [3], DisplayName = "New phone" };
        fixture.Db.MemberPasskeyCredentials.Add(pending);
        var completed = await fixture.Service.CompletePasskeyActivationAsync(flow!.Id, pending.Id, default);
        Assert.Equal(!losePermission && !expire, completed.IsSuccess);
        var old = await fixture.Db.MemberPasskeyCredentials.SingleAsync(x => x.CredentialId == new byte[] { 1 });
        Assert.Equal(completed.IsSuccess, old.RevokedUtc is not null);
        Assert.Null(pending.RevokedUtc);
        if (completed.IsSuccess) Assert.False((await fixture.Service.CompletePasskeyActivationAsync(flow.Id, pending.Id, default)).IsSuccess);
    }
}
