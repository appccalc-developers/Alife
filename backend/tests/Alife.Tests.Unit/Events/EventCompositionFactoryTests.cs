using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;

namespace Alife.Tests.Unit.Events;

public sealed class EventCompositionFactoryTests
{
    [Fact]
    public void CreateInitial_composes_modules_from_event_facts_and_creates_versioned_snapshot()
    {
        var actorId = Guid.NewGuid();
        var groupEvent = NewEvent("""
            {
              "locationName":{"en":"Church hall","zh":"教会礼堂"},
              "maxCapacity":120,
              "registrationDeadline":"2026-09-20T00:00:00Z",
              "baseFeePerAdult":10,
              "hardConstraints":[{"ruleKey":"children"}]
            }
            """);

        var plan = EventCompositionFactory.CreateInitial(groupEvent, actorId, "{}", DateTime.UtcNow);

        Assert.Equal(1, plan.CurrentRevision);
        Assert.Equal(["communications", "core", "finance", "ram", "registration"],
            plan.Modules.Where(x => x.IsRequired).Select(x => x.ModuleKey).OrderBy(x => x).ToArray());
        Assert.Single(plan.Occurrences);
        Assert.Single(plan.Revisions);
        Assert.Equal(5, plan.ReadinessGates.Count(x => x.IsRequired));
        Assert.Equal(EventReadinessStatus.Satisfied, plan.ReadinessGates.Single(x => x.GateKey == "core.configured").Status);
    }

    [Fact]
    public void Revise_preserves_history_and_reconciles_selected_modules()
    {
        var actorId = Guid.NewGuid();
        var groupEvent = NewEvent("{\"maxCapacity\":50}");
        var plan = EventCompositionFactory.CreateInitial(groupEvent, actorId, null, DateTime.UtcNow);
        groupEvent.EventDataJson = "{\"locationName\":{\"en\":\"Park\",\"zh\":\"公园\"}}";

        EventCompositionFactory.Revise(plan, groupEvent, actorId, null, DateTime.UtcNow.AddMinutes(5));

        Assert.Equal(2, plan.CurrentRevision);
        Assert.Equal(2, plan.Revisions.Count);
        Assert.False(plan.Modules.Single(x => x.ModuleKey == "registration").IsRequired);
        Assert.DoesNotContain(plan.Modules, x => x.ModuleKey == "venue" && x.IsRequired);
        Assert.DoesNotContain("\"venue\"", plan.Revisions.Single(x => x.Revision == 2).CompositionJson);
    }

    [Fact]
    public void CreateInitial_adds_roster_only_when_event_facts_request_it()
    {
        var groupEvent = NewEvent("{\"requiresRoster\":true}");

        var plan = EventCompositionFactory.CreateInitial(groupEvent, Guid.NewGuid(), "{}", DateTime.UtcNow);

        Assert.True(plan.Modules.Single(x => x.ModuleKey == "roster").IsRequired);
        Assert.Contains(plan.ReadinessGates, x => x.GateKey == "roster.configured" && x.IsRequired);
    }

    [Fact]
    public void Legacy_location_text_does_not_become_a_church_venue_request()
    {
        var groupEvent = NewEvent("""{"locationName":{"en":"Public park","zh":"公共公园"}}""");

        var plan = EventCompositionFactory.CreateInitial(groupEvent, Guid.NewGuid(), null, DateTime.UtcNow);

        Assert.DoesNotContain(plan.Modules, x => x.ModuleKey == "venue" && x.IsRequired);
        Assert.False(EventCompositionFactory.UsesOptionalModule(groupEvent.EventDataJson, "venue"));
    }

    [Fact]
    public void Finance_module_is_selected_only_for_positive_charges()
    {
        var noChargeEvent = NewEvent("""{"optionalActivities":[{"name":{"en":"Workshop","zh":"工作坊"},"extraFee":0}]}""");
        var chargedEvent = NewEvent("""{"optionalActivities":[{"name":{"en":"Workshop","zh":"工作坊"},"extraFee":15}]}""");

        var noChargePlan = EventCompositionFactory.CreateInitial(noChargeEvent, Guid.NewGuid(), null, DateTime.UtcNow);
        var chargedPlan = EventCompositionFactory.CreateInitial(chargedEvent, Guid.NewGuid(), null, DateTime.UtcNow);

        Assert.DoesNotContain(noChargePlan.Modules, x => x.ModuleKey == "finance" && x.IsRequired);
        Assert.Contains(chargedPlan.Modules, x => x.ModuleKey == "finance" && x.IsRequired);
    }

    [Fact]
    public void Explicit_empty_module_selection_keeps_optional_modules_out_even_when_fields_have_values()
    {
        var groupEvent = NewEvent("""
            {
              "enabledModules":[],
              "locationName":{"en":"Church hall","zh":"教会礼堂"},
              "maxCapacity":120,
              "baseFeePerAdult":10,
              "requiresRoster":true,
              "hardConstraints":[{"ruleKey":"children"}]
            }
            """);

        var plan = EventCompositionFactory.CreateInitial(groupEvent, Guid.NewGuid(), """{"isOuting":true}""", DateTime.UtcNow);

        Assert.Equal(["communications", "core"],
            plan.Modules.Where(x => x.IsRequired).Select(x => x.ModuleKey).OrderBy(x => x).ToArray());
        Assert.False(EventCompositionFactory.RequiresRam(groupEvent.EventDataJson, """{"isOuting":true}"""));
    }

    [Fact]
    public void Explicit_module_selection_requires_only_the_items_chosen_by_the_leader()
    {
        var groupEvent = NewEvent("""
            {
              "enabledModules":["venue","roster"],
              "maxCapacity":120,
              "baseFeePerAdult":10,
              "hardConstraints":[{"ruleKey":"children"}]
            }
            """);

        var plan = EventCompositionFactory.CreateInitial(groupEvent, Guid.NewGuid(), null, DateTime.UtcNow);
        groupEvent.Plan = plan;

        Assert.Equal(["communications", "core", "roster", "venue"],
            plan.Modules.Where(x => x.IsRequired).Select(x => x.ModuleKey).OrderBy(x => x).ToArray());
        Assert.DoesNotContain(plan.Modules, x => (x.ModuleKey is "finance" or "ram" or "registration") && x.IsRequired);
        Assert.Equal(["roster", "venue"], EventCompositionFactory.SelectedOptionalModules(groupEvent));
    }

    private static GroupEvent NewEvent(string factsJson) => new()
    {
        Id = Guid.NewGuid(), GroupId = Guid.NewGuid(), CreatedByMemberId = Guid.NewGuid(),
        TitleEn = "Community event", TitleZh = "社区活动",
        StartDate = DateTime.UtcNow.AddDays(10), EndDate = DateTime.UtcNow.AddDays(10).AddHours(2),
        EventDataJson = factsJson, CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
    };
}
