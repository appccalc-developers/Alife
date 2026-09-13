using System.Text.Json;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Alife.Infrastructure.ReadServices;
using Microsoft.Extensions.Caching.Hybrid;
using Microsoft.Extensions.DependencyInjection;

namespace Alife.Tests.Unit.Events;

public sealed partial class EventOperationsCoreTests
{
    [Fact]
    public async Task DefaultPositions_AreExplicitVersionedAndExtendOnlyMissingDatesWithoutPeople()
    {
        await using var db = CreateDb(); var owner = Guid.NewGuid(); var member = Guid.NewGuid();
        var e = SeedEvent(db, Guid.NewGuid(), owner); var first = SeedOccurrence(db, e);
        db.Members.AddRange(Member(owner, "Owner"), Member(member, "Member")); SeedPlan(db, e, Fact("people.volunteersRequired", true));
        var zone = TimeZoneInfo.FindSystemTimeZoneById("Australia/Sydney");
        var anchor = DateTime.SpecifyKind(TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, zone).Date.AddDays(1).AddHours(19), DateTimeKind.Unspecified);
        first.StartUtc = TimeZoneInfo.ConvertTimeToUtc(anchor, zone); first.EndUtc = first.StartUtc.AddHours(2); first.LocalDate = DateOnly.FromDateTime(anchor);
        var except = DateOnly.FromDateTime(anchor.AddDays(7));
        var series = new EventSeries { Id = Guid.NewGuid(), OwningGroupId = e.GroupId, CreatedByMemberId = owner, RecurrenceRule = "FREQ=WEEKLY", TimeZone = zone.Id,
            FirstStartLocal = anchor, DurationMinutes = 120, ExceptionDatesJson = JsonSerializer.Serialize(new[] { except }) };
        db.EventSeries.Add(series); e.EventSeriesId = series.Id;
        await db.SaveChangesAsync(); var service = new EventOperationsService(db, Authorization(owner));
        Assert.Equal(AppResultStatus.Conflict, (await service.ExtendRosterAsync(e.Id, owner, "\"new\"", default)).Status);
        await service.SaveRosterGroupAsync(e.Id, owner, new("welcome", "SERVICE.ROSTER", [member]), "\"new\"", default);
        var roster = (await service.GetRosterAsync(e.Id, first.Id, owner, default)).Value!;
        roster = (await service.CreateSlotAsync(e.Id, first.Id, owner, new(null, null, null, "welcome", first.StartUtc.AddMinutes(-15), first.EndUtc, 1, "approvedGroupMember"), roster.ETag, default)).Value!;
        // Preserve an existing invitation; default requirements must never include this identity.
        var invited = await service.AssignRosterMemberAsync(e.Id, first.Id, roster.Slots[0].Id, owner, new(member), roster.ETag, default);
        Assert.True(invited.IsSuccess, invited.Message);
        var adopted = await service.AdoptRosterDefaultsAsync(e.Id, owner, new(first.Id, invited.Value!.ETag, "\"new\""), default);
        Assert.True(adopted.IsSuccess, adopted.Message);
        var defaults = await db.EventRosterDefaults.SingleAsync();
        Assert.DoesNotContain(member.ToString(), defaults.RequirementsJson); Assert.Equal(1, defaults.Version);
        var firstVersion = (await service.GetRosterAsync(e.Id, first.Id, owner, default)).Value!.ETag;
        var result = await service.ExtendRosterAsync(e.Id, owner, adopted.Value!.DefaultsETag, default);
        Assert.True(result.IsSuccess, result.Message);
        var dates = await db.EventOccurrences.Include(x => x.ServiceSlots).ThenInclude(x => x.Assignments).OrderBy(x => x.StartUtc).ToListAsync();
        Assert.InRange(dates.Count, 10, 12); Assert.DoesNotContain(dates, x => x.LocalDate == except);
        foreach (var date in dates.Where(x => x.Id != first.Id))
        {
            var slot = Assert.Single(date.ServiceSlots); Assert.Equal(defaults.Id, slot.RosterDefaultsId);
            Assert.Equal(date.StartUtc.AddMinutes(-15), slot.StartUtc); Assert.Empty(slot.Assignments);
            Assert.Equal(19, TimeZoneInfo.ConvertTimeFromUtc(DateTime.SpecifyKind(date.StartUtc, DateTimeKind.Utc), zone).Hour);
        }
        Assert.Equal(firstVersion, (await service.GetRosterAsync(e.Id, first.Id, owner, default)).Value!.ETag);
        Assert.True((await service.ExtendRosterAsync(e.Id, owner, adopted.Value.DefaultsETag, default)).IsSuccess);
        Assert.Equal(dates.Count, await db.EventOccurrences.CountAsync()); Assert.Single(db.EventRosterAssignments); Assert.Single(db.NotificationMessages);
        Assert.Equal(AppResultStatus.PreconditionFailed, (await service.ExtendRosterAsync(e.Id, owner, "old", default)).Status);
        var focused = await service.GetRosterPageAsync(e.Id, owner, 1, default, dates[^1].Id);
        Assert.True(focused.IsSuccess, focused.Message); Assert.Contains(focused.Value!.Occurrences, x => x.Id == dates[^1].Id);
        Assert.Equal(AppResultStatus.NotFound, (await service.GetRosterPageAsync(e.Id, owner, 1, default, Guid.NewGuid())).Status);
    }
}

public sealed partial class EventPackageFoundationTests
{
    [Fact]
    public async Task RosterV2_AdditionalDatesDoNotBroadenOrStaleAnExistingApprovalWindow()
    {
        await using var db = CreateDb(); var seeded = await SeedAsync(db, series: true, modules: ["TEAM.WORK"]);
        var service = new EventPackageService(db, Authorization());
        var generated = await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "original-window", default);
        Assert.True(generated.IsSuccess, generated.Message);
        var last = seeded.Occurrences.OrderBy(x => x.StartUtc).Last();
        var added = new EventOccurrence { Id = Guid.NewGuid(), EventId = seeded.Event.Id, StartUtc = last.StartUtc.AddDays(7), EndUtc = last.EndUtc.AddDays(7), LocalDate = last.LocalDate.AddDays(7) };
        db.EventOccurrences.Add(added); await db.SaveChangesAsync();
        var submitted = await service.SubmitAsync(seeded.Event.Id, generated.Value!.Id, seeded.Owner, generated.Value.ETag, "submit-original-window", default);
        Assert.True(submitted.IsSuccess, submitted.Message);
        Assert.Equal(generated.Value.SourceVectorHash, submitted.Value!.SourceVectorHash);
        Assert.DoesNotContain(added.Id, submitted.Value.Manifest.CoveredOccurrenceIds);
        Assert.Equal(generated.Value.Manifest.CoveredOccurrenceIds, submitted.Value.Manifest.CoveredOccurrenceIds);
    }

    [Fact]
    public async Task ExplicitPublicationWithoutRequiredRam_IsRecheckedAfterSafetyChangesOnCacheHit()
    {
        await using var db = CreateDb(); var seeded = await SeedAsync(db, series: false, modules: ["TEAM.WORK"]);
        seeded.Event.StartDate = DateTime.UtcNow.AddDays(1); seeded.Event.EndDate = DateTime.UtcNow.AddDays(2);
        seeded.Event.EventDataJson = "{\"visibility\":\"public\"}";
        seeded.Event.PublicationStatus = EventPublicationStatus.Published;
        seeded.Event.PublicationGateMode = EventPackageEnforcementMode.Off;
        await db.SaveChangesAsync();
        var registrations = new ServiceCollection(); registrations.AddHybridCache(); using var provider = registrations.BuildServiceProvider();
        var reads = new EventReadService(db, provider.GetRequiredService<HybridCache>());
        Assert.Single(await reads.GetPublicUpcomingEventsAsync(DateTime.UtcNow, 50, default));
        seeded.Event.EventDataJson = "{\"visibility\":\"public\",\"requiresRam\":true}"; await db.SaveChangesAsync();
        Assert.Empty(await reads.GetPublicUpcomingEventsAsync(DateTime.UtcNow, 50, default));
    }

    [Fact]
    public async Task RosterV2_SourceSeparatesOrdinaryResponsesFromFrozenRequirements()
    {
        await using var db = CreateDb(); var seeded = await SeedAsync(db, series: true, modules: ["SERVICE.ROSTER"]);
        var first = seeded.Occurrences[0];
        var slot = new EventServiceSlot { Id = Guid.NewGuid(), OccurrenceId = first.Id, RoleCode = "welcome", RequiredCount = 1, EligibilityCode = "approvedGroupMember", StartUtc = first.StartUtc, EndUtc = first.EndUtc };
        db.EventServiceSlots.Add(slot); db.EventRosterGroups.Add(new() { Id = Guid.NewGuid(), EventId = seeded.Event.Id, RoleCode = "welcome", ModuleCode = "SERVICE.ROSTER", MemberIdsJson = JsonSerializer.Serialize(new[] { seeded.Owner }) });
        await db.SaveChangesAsync();
        var service = new EventPackageService(db, Authorization());
        var before = await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "roster-before", default);
        Assert.True(before.IsSuccess, before.Message); Assert.Equal(2, before.Value!.Manifest.RosterRulesVersion);
        Assert.DoesNotContain(before.Value.Manifest.Modules.Single(x => x.ModuleCode == "SERVICE.ROSTER").Blockers, x => x.En.Contains("confirmed"));
        db.EventRosterAssignments.Add(new() { Id = Guid.NewGuid(), ServiceSlotId = slot.Id, MemberId = seeded.Owner, AssignedByMemberId = seeded.Owner, Status = EventRosterAssignmentStatus.Confirmed, ConfirmedUtc = DateTime.UtcNow });
        first.RosterConcurrencyToken = Guid.NewGuid(); slot.UpdatedUtc = DateTime.UtcNow;
        var group = await db.EventRosterGroups.SingleAsync(); group.ConcurrencyToken = Guid.NewGuid(); await db.SaveChangesAsync();
        var after = await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "roster-response", default);
        Assert.True(after.IsSuccess, after.Message); Assert.Equal(before.Value.SourceVectorHash, after.Value!.SourceVectorHash);
        slot.RequiredCount = 2; await db.SaveChangesAsync();
        var changed = await service.GenerateAsync(seeded.Event.Id, seeded.Owner, new(), seeded.Plan.ETag, "roster-requirement", default);
        Assert.True(changed.IsSuccess, changed.Message); Assert.NotEqual(after.Value.SourceVectorHash, changed.Value!.SourceVectorHash);
    }
}
