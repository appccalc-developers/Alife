using Alife.Application.Common.Models;
using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Tests.Unit.Events;

public sealed partial class EventPackageFoundationTests
{
    [Theory]
    [InlineData("event.lead")]
    [InlineData("leader")]
    [InlineData("coLeader")]
    [InlineData("member")]
    public async Task Submit_OnlyOwner_NotAcceptedLeadOrGroupLeadership(string role)
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, series: false, modules: ["TEAM.WORK"]);
        var actor = Guid.NewGuid();
        db.GroupMemberships.Add(new GroupMembership {
            Id = Guid.NewGuid(), GroupId = seeded.Event.GroupId, MemberId = actor,
            Status = MembershipStatus.Approved,
            Role = role == "leader" ? MembershipRole.Leader : role == "coLeader" ? MembershipRole.CoLeader : MembershipRole.Member,
            CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        });
        if (role == "event.lead") db.EventRoleAssignments.Add(new EventRoleAssignment {
            Id = Guid.NewGuid(), EventId = seeded.Event.Id, MemberId = actor,
            RoleRequirementKey = "TEAM.WORK:event.lead", Status = EventRoleAssignmentStatus.Accepted,
            AssignedByMemberId = seeded.Owner, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        var service = new EventPackageService(db, Authorization());
        var generated = await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "owner-generate", default);
        Assert.True(generated.IsSuccess, generated.Message);
        var package = generated.Value!;
        var capabilities = await service.GetCapabilitiesAsync(seeded.Event.Id, package.Id, actor, default);
        Assert.True(capabilities.Status == AppResultStatus.Forbidden || capabilities.IsSuccess && !capabilities.Value!.CanSubmit);
        var denied = await service.SubmitAsync(seeded.Event.Id, package.Id, actor, package.ETag, "non-owner-submit", default);
        Assert.Equal(AppResultStatus.Forbidden, denied.Status);
        Assert.Equal(EventPackageStatus.Draft, (await db.EventPackages.SingleAsync()).Status);
        Assert.Null((await db.EventPackages.SingleAsync()).SubmittedByMemberId);
        var ownerCapabilities = await service.GetCapabilitiesAsync(seeded.Event.Id, package.Id, seeded.Owner, default);
        Assert.True(ownerCapabilities.Value!.CanSubmit);
        var submitted = await service.SubmitAsync(seeded.Event.Id, package.Id, seeded.Owner, package.ETag, "owner-submit", default);
        Assert.True(submitted.IsSuccess, submitted.Message);
        Assert.Equal(seeded.Owner, (await db.EventPackages.SingleAsync()).SubmittedByMemberId);
        var nonOwnerAfterSubmit = await service.GetCapabilitiesAsync(seeded.Event.Id, package.Id, actor, default);
        Assert.True(nonOwnerAfterSubmit.Status == AppResultStatus.Forbidden || nonOwnerAfterSubmit.IsSuccess && !nonOwnerAfterSubmit.Value!.CanWithdraw);
        var deniedWithdrawal = await service.WithdrawAsync(seeded.Event.Id, package.Id, actor, submitted.Value!.ETag, "non-owner-withdraw", default);
        Assert.Equal(AppResultStatus.Forbidden, deniedWithdrawal.Status);
        var withdrawn = await service.WithdrawAsync(seeded.Event.Id, package.Id, seeded.Owner, submitted.Value.ETag, "owner-withdraw", default);
        Assert.True(withdrawn.IsSuccess, withdrawn.Message);
        Assert.Equal(EventPackageStatus.Withdrawn, withdrawn.Value!.Status);
    }

    [Fact]
    public async Task Submit_RechecksOwnerMembership_EvenWhenTheyRetainAnAcceptedLeadAssignment()
    {
        await using var db = CreateDb();
        var seeded = await SeedAsync(db, series: false, modules: ["TEAM.WORK"]);
        db.EventRoleAssignments.Add(new EventRoleAssignment {
            Id = Guid.NewGuid(), EventId = seeded.Event.Id, MemberId = seeded.Owner,
            RoleRequirementKey = "TEAM.WORK:event.lead", Status = EventRoleAssignmentStatus.Accepted,
            AssignedByMemberId = seeded.Owner, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        var service = new EventPackageService(db, Authorization());
        var generated = await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "generate", default);
        Assert.True(generated.IsSuccess, generated.Message);
        db.GroupMemberships.Remove(await db.GroupMemberships.SingleAsync(x => x.MemberId == seeded.Owner));
        await db.SaveChangesAsync();
        var denied = await service.SubmitAsync(seeded.Event.Id, generated.Value!.Id, seeded.Owner, generated.Value.ETag, "departed-submit", default);
        Assert.Equal(AppResultStatus.Forbidden, denied.Status);
        Assert.Equal(EventPackageStatus.Draft, (await db.EventPackages.SingleAsync()).Status);
    }
}
