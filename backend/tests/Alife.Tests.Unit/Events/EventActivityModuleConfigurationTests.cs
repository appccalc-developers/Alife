using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public sealed class EventActivityModuleConfigurationTests
{
    [Fact]
    public async Task ProjectMealConfiguration_IsVersionedPrivateAndBoundToConfirmedNeed()
    {
        await using var db = new AlifeDbContext(new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        var owner = Guid.NewGuid(); var outsider = Guid.NewGuid(); var groupId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        db.Groups.Add(new Group { Id = groupId, IsChurch = true, NameJson = "{}" });
        db.Members.Add(new Member { Id = owner, DisplayName = "Owner" });
        db.Members.Add(new Member { Id = outsider, DisplayName = "Outsider" });
        db.GroupMemberships.Add(new GroupMembership { Id = Guid.NewGuid(), GroupId = groupId, MemberId = owner,
            Status = MembershipStatus.Approved });
        db.GroupEvents.Add(new GroupEvent { Id = eventId, GroupId = groupId, CreatedByMemberId = owner,
            AccountableOwnerMemberId = owner, StartDate = DateTime.UtcNow.AddDays(2),
            EndDate = DateTime.UtcNow.AddDays(3), EventDataJson = "{}" });
        db.EventActivityPlans.Add(new EventActivityPlan { EventId = eventId,
            DataJson = RamEvaluator.Serialize(new ActivityPlanData([
                new("meal-one", ["meal"], new("Meal", "聚餐"), new("", ""), Answers:
                    new Dictionary<string, PlannedActivityAnswer> { ["foodService"] = new("yes", "human", true) }),
                new("meal-two", ["meal"], new("Meal", "聚餐"), new("", ""), Answers:
                    new Dictionary<string, PlannedActivityAnswer> { ["foodService"] = new("no", "human", true) })
            ], QuestionnaireVersion: 2)) });
        await db.SaveChangesAsync();
        var service = new EventActivityModuleConfigurationService(db,
            Substitute.For<IEventPackageInvalidationService>(), Substitute.For<IEventCacheInvalidationService>());
        var details = new SaveProjectModuleConfigurationRequest(null, Meal: new(
            new("Barbecue", "烧烤"), new("Camp kitchen", "营地厨房"),
            new("Ask about allergens", "询问过敏原"), new("Food temperature checks", "食物温度检查")));

        Assert.Equal(AppResultStatus.Forbidden, (await service.GetAsync(eventId, outsider, default)).Status);
        Assert.Equal(AppResultStatus.Conflict, (await service.SaveAsync(eventId, "meal-two", "meal", owner,
            details, EventActivityModuleConfigurationService.NewETag, default)).Status);
        var first = await service.SaveAsync(eventId, "meal-one", "meal", owner, details,
            EventActivityModuleConfigurationService.NewETag, default);
        Assert.True(first.IsSuccess, first.Message);
        Assert.Equal(AppResultStatus.PreconditionFailed, (await service.SaveAsync(eventId, "meal-one", "meal", owner,
            details with { Meal = details.Meal! with { ServiceMethod = new("Catered", "外包餐饮") } },
            EventActivityModuleConfigurationService.NewETag, default)).Status);
        var updated = await service.SaveAsync(eventId, "meal-one", "meal", owner,
            details with { Meal = details.Meal! with { ServiceMethod = new("Catered", "外包餐饮") } },
            first.Value!.ETag, default);
        Assert.True(updated.IsSuccess, updated.Message);
        Assert.Single(await db.EventActivityModuleConfigurations.ToArrayAsync());
        var workspace = (await service.GetAsync(eventId, owner, default)).Value!;
        Assert.Contains("meal", workspace.CanEditKinds);
        Assert.Equal("Catered", workspace.Items.Single().Details.Meal!.ServiceMethod.En);
    }
}
