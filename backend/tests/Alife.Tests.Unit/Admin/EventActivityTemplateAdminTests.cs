using Alife.Api.Controllers;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Admin;
using Alife.Application.Admin.Dtos;
using Alife.Application.Admin.EventTemplates;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;

namespace Alife.Tests.Unit.Admin;

public sealed class EventActivityTemplateAdminTests
{
    [Fact]
    public async Task Catalog_ProvidesFourImmutableCategoriesAndSixteenActiveSystemPresets()
    {
        await using var db = CreateDbContext();
        var catalog = new EventActivityTemplateCatalog(db);

        var entries = await catalog.ListAsync(true, CancellationToken.None);
        var archetypes = await catalog.ListActiveArchetypesAsync(CancellationToken.None);

        Assert.Equal(16, entries.Count);
        Assert.All(entries, item =>
        {
            Assert.True(item.IsActive);
            Assert.True(item.IsSystemPreset);
        });
        Assert.Equal(4, archetypes.Count);
        Assert.All(archetypes, item => Assert.Equal(4, item.ActivityTypes.Count));
    }

    [Fact]
    public async Task AdminOperations_RequireTheDedicatedServerPermission()
    {
        await using var db = CreateDbContext();
        var actorId = await SeedActorAsync(db, permissions: []);
        var catalog = new EventActivityTemplateCatalog(db);

        var list = await new ListAdminEventActivityTemplatesQueryHandler(db, catalog).Handle(
            new(actorId, null, null, null, null, null), CancellationToken.None);
        var create = await new CreateAdminEventActivityTemplateCommandHandler(db, catalog).Handle(
            new(actorId, CreateRequest("community-picnic")), CancellationToken.None);

        Assert.Equal(AppResultStatus.Forbidden, list.Status);
        Assert.Equal(AppResultStatus.Forbidden, create.Status);
        Assert.Empty(db.EventActivityTemplateVersions);
        Assert.Empty(db.AuditLogs);
    }

    [Fact]
    public async Task Create_AddsAnActiveCustomTemplateOnlyInsideAFixedCategory()
    {
        await using var db = CreateDbContext();
        var actorId = await SeedActorAsync(db, [AdminPermissionCatalog.ManageEventTemplates]);
        var catalog = new EventActivityTemplateCatalog(db);
        var handler = new CreateAdminEventActivityTemplateCommandHandler(db, catalog);

        var result = await handler.Handle(
            new(actorId, CreateRequest("community-picnic")), CancellationToken.None);

        Assert.True(result.IsSuccess, result.Message);
        Assert.Equal("community-picnic", result.Value!.Template.Code);
        Assert.Equal("simple-social", result.Value.Template.ArchetypeCode);
        Assert.Equal(1, result.Value.Template.Version);
        Assert.True(result.Value.IsActive);
        Assert.False(result.Value.IsSystemPreset);
        Assert.StartsWith("\"event-template-community-picnic-v1-", result.Value.ETag);
        Assert.Equal(17, (await catalog.ListAsync(false, CancellationToken.None)).Count);
        Assert.Contains((await catalog.ListActiveArchetypesAsync(CancellationToken.None))
            .Single(x => x.Code == "simple-social").ActivityTypes,
            x => x.Code == "community-picnic");
        Assert.Equal("event-template.create", (await db.AuditLogs.SingleAsync()).Action);
    }

    [Theory]
    [InlineData("new-category", "COMMS.FOLLOWUP", false)]
    [InlineData("simple-social", "MONEY.FINANCE", false)]
    [InlineData("simple-social", "SERVICE.ROSTER", false)]
    public async Task Create_FailsClosedForUnknownCategoryOrUnsafePreset(
        string archetypeCode,
        string moduleCode,
        bool addRosterSlot)
    {
        await using var db = CreateDbContext();
        var actorId = await SeedActorAsync(db, [AdminPermissionCatalog.ManageEventTemplates]);
        var catalog = new EventActivityTemplateCatalog(db);
        var request = CreateRequest(
            "invalid-template",
            archetypeCode,
            [moduleCode],
            addRosterSlot
                ? [new("host", new("Host", "接待"), 1, "approvedGroupMember")]
                : []);

        var result = await new CreateAdminEventActivityTemplateCommandHandler(db, catalog).Handle(
            new(actorId, request), CancellationToken.None);

        Assert.Equal(AppResultStatus.ValidationError, result.Status);
        Assert.Empty(db.EventActivityTemplateVersions);
    }

    [Fact]
    public async Task Update_CreatesAnImmutableNextVersionAndRejectsAStaleETag()
    {
        await using var db = CreateDbContext();
        var actorId = await SeedActorAsync(db, [AdminPermissionCatalog.ManageEventTemplates]);
        var catalog = new EventActivityTemplateCatalog(db);
        var created = await new CreateAdminEventActivityTemplateCommandHandler(db, catalog).Handle(
            new(actorId, CreateRequest("community-picnic")), CancellationToken.None);
        var handler = new UpdateAdminEventActivityTemplateCommandHandler(db, catalog);
        var update = UpdateRequest(created.Value!, isActive: true) with
        {
            Name = new("Neighbourhood picnic", "社区野餐")
        };

        var saved = await handler.Handle(
            new(actorId, "community-picnic", created.Value!.ETag, update), CancellationToken.None);
        var stale = await handler.Handle(
            new(actorId, "community-picnic", created.Value.ETag, update), CancellationToken.None);

        Assert.True(saved.IsSuccess, saved.Message);
        Assert.Equal(2, saved.Value!.Template.Version);
        Assert.Equal("simple-social", saved.Value.Template.ArchetypeCode);
        Assert.Equal("Neighbourhood picnic", saved.Value.Template.Name.En);
        Assert.Equal(AppResultStatus.PreconditionFailed, stale.Status);
        var versions = await db.EventActivityTemplateVersions
            .Where(x => x.Code == "community-picnic")
            .OrderBy(x => x.Version)
            .ToListAsync();
        Assert.Equal(2, versions.Count);
        Assert.False(versions[0].IsCurrent);
        Assert.True(versions[1].IsCurrent);
        Assert.Equal(2, await db.AuditLogs.CountAsync());
    }

    [Fact]
    public async Task SystemPreset_CanBeEditedOrDeactivatedWithoutChangingItsCodeOrCategory()
    {
        await using var db = CreateDbContext();
        var actorId = await SeedActorAsync(db, [AdminPermissionCatalog.ManageEventTemplates]);
        var catalog = new EventActivityTemplateCatalog(db);
        var current = Assert.IsType<EventActivityTemplateCatalogEntry>(
            await catalog.FindAsync("shared-meal", true, CancellationToken.None));
        var source = new AdminEventActivityTemplateDto(
            current.Definition.ToDto(), current.IsActive, current.IsSystemPreset,
            current.ETag, current.UpdatedUtc);
        var update = UpdateRequest(source, isActive: false) with
        {
            Description = new("Updated by system administration.", "由系统管理更新。")
        };

        var result = await new UpdateAdminEventActivityTemplateCommandHandler(db, catalog).Handle(
            new(actorId, "shared-meal", current.ETag, update), CancellationToken.None);

        Assert.True(result.IsSuccess, result.Message);
        Assert.Equal("shared-meal", result.Value!.Template.Code);
        Assert.Equal("simple-social", result.Value.Template.ArchetypeCode);
        Assert.Equal(3, result.Value.Template.Version);
        Assert.True(result.Value.IsSystemPreset);
        Assert.False(result.Value.IsActive);
        Assert.DoesNotContain("shared-meal",
            (await catalog.ActiveDefinitionsByCodeAsync(CancellationToken.None)).Keys);
        Assert.Equal(2, await db.EventActivityTemplateVersions.CountAsync(x => x.Code == "shared-meal"));
    }

    [Fact]
    public async Task Deactivate_RemovesTemplateFromNewCompositionButPreservesHistory()
    {
        await using var db = CreateDbContext();
        var actorId = await SeedActorAsync(db, [AdminPermissionCatalog.ManageEventTemplates]);
        var catalog = new EventActivityTemplateCatalog(db);
        var created = await new CreateAdminEventActivityTemplateCommandHandler(db, catalog).Handle(
            new(actorId, CreateRequest("community-picnic")), CancellationToken.None);
        var activeDefinitions = await catalog.ActiveDefinitionsByCodeAsync(CancellationToken.None);
        var activeProposal = Compose("community-picnic", activeDefinitions);

        var deactivated = await new UpdateAdminEventActivityTemplateCommandHandler(db, catalog).Handle(
            new(actorId, "community-picnic", created.Value!.ETag,
                UpdateRequest(created.Value, isActive: false)), CancellationToken.None);
        var currentDefinitions = await catalog.ActiveDefinitionsByCodeAsync(CancellationToken.None);
        var inactiveProposal = Compose("community-picnic", currentDefinitions);

        Assert.True(activeProposal.IsSuccess, activeProposal.Message);
        Assert.Contains(activeProposal.Value!.ModuleDecisions,
            x => x.ModuleCode == "COMMS.FOLLOWUP" && x.Status != Domain.Enums.EventModuleDecisionStatus.Inactive);
        Assert.True(deactivated.IsSuccess, deactivated.Message);
        Assert.False(deactivated.Value!.IsActive);
        Assert.DoesNotContain("community-picnic", currentDefinitions.Keys);
        Assert.Equal(AppResultStatus.ValidationError, inactiveProposal.Status);
        Assert.Equal("Unknown activityTypeCode.", inactiveProposal.Message);
        Assert.Equal(2, await db.EventActivityTemplateVersions.CountAsync(x => x.Code == "community-picnic"));
        Assert.Equal("event-template.deactivate", (await db.AuditLogs.OrderBy(x => x.OccurredUtc).LastAsync()).Action);
    }

    [Fact]
    public async Task AdminEndpoint_IsViewerSpecificPrivateNoStore()
    {
        var actorId = Guid.NewGuid();
        var mediator = Substitute.For<IMediator>();
        var accessor = Substitute.For<ICurrentMemberAccessor>();
        accessor.GetCurrentMemberId().Returns(actorId);
        mediator.Send(Arg.Any<ListAdminEventActivityTemplatesQuery>(), Arg.Any<CancellationToken>())
            .Returns(AppResult<AdminEventActivityTemplateCatalogDto>.Success(new(
                [], new([], 0, 1, 25, 0), [], [], [], true)));
        var controller = new AdminEventTemplatesController(mediator, accessor)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };

        var result = await controller.List(null, null, null, null, null, 1, 25, CancellationToken.None);

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal("private, no-store", controller.Response.Headers.CacheControl.ToString());
        Assert.Equal("no-cache", controller.Response.Headers.Pragma.ToString());
        Assert.Contains("Cookie", controller.Response.Headers.Vary.ToString());
        Assert.Contains("Authorization", controller.Response.Headers.Vary.ToString());
    }

    private static AppResult<EventPlanProposalDto> Compose(
        string activityTypeCode,
        IReadOnlyDictionary<string, EventActivityTypeDefinition> definitions)
        => new EventCompositionEngine().Compose(
            new(
                EventCompositionDefinitions.SchemaVersion,
                "simple-social",
                new([]),
                [],
                ActivityTypeCode: activityTypeCode),
            new("\"baseline\"", ActivityTypesByCode: definitions));

    private static CreateAdminEventActivityTemplateRequest CreateRequest(
        string code,
        string archetypeCode = "simple-social",
        IReadOnlyList<string>? modules = null,
        IReadOnlyList<EventActivityTypeServiceSlotPresetDto>? slots = null)
        => new(
            code,
            archetypeCode,
            new("Community picnic", "社区野餐"),
            new("A reusable local gathering template.", "可重复使用的本地聚会模板。"),
            "outdoors",
            new("groupVisible", "required", "People"),
            modules ?? ["PEOPLE.REGISTRATION", "COMMS.FOLLOWUP"],
            null,
            slots ?? [],
            true);

    private static UpdateAdminEventActivityTemplateRequest UpdateRequest(
        AdminEventActivityTemplateDto source,
        bool isActive)
        => new(
            source.Template.Name,
            source.Template.Description,
            source.Template.IconKey,
            source.Template.Defaults,
            source.Template.PreselectedModules,
            source.Template.RecommendedWorkflowTemplateCode,
            source.Template.PresetServiceSlots,
            isActive);

    private static async Task<Guid> SeedActorAsync(
        AlifeDbContext db,
        IReadOnlyList<string> permissions)
    {
        var actorId = Guid.NewGuid();
        const int roleId = 9042;
        db.Members.Add(new()
        {
            Id = actorId,
            DisplayName = "Event template administrator",
            IsRegistered = true,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        db.PlatformRoles.Add(new()
        {
            Id = roleId,
            Code = "event_template_admin",
            NameJson = "{\"en\":\"Event template admin\",\"zh\":\"活动模板管理员\"}",
            PermissionsJson = AdminPermissionCatalog.WritePermissions(permissions),
            Level = 50
        });
        db.MemberPlatformRoles.Add(new()
        {
            Id = Guid.NewGuid(),
            MemberId = actorId,
            RoleId = roleId,
            AssignedByMemberId = actorId,
            AssignedUtc = DateTime.UtcNow
        });
        await db.SaveChangesAsync();
        return actorId;
    }

    private static AlifeDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString("N"))
            .Options;
        return new AlifeDbContext(options);
    }
}
