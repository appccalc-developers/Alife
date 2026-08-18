using Alife.Application.Events.Commands.InitializeEventWorkflow;
using Alife.Application.Events.Commands.CreateEventWorkflowTemplate;
using Alife.Application.Events.Queries.GetEventWorkflow;
using Alife.Application.Events.Queries.ListEventWorkflowTemplates;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public class EventWorkflowFrameworkTests
{
    [Fact]
    public async Task CreateCustomTemplate_AsLeader_SavesBilingualOrderedApprovalStages()
    {
        using var dbContext = CreateDbContext();
        var groupId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);
        var handler = new CreateEventWorkflowTemplateCommandHandler(dbContext, authorization);

        var result = await handler.Handle(new CreateEventWorkflowTemplateCommand(
            groupId,
            leaderId,
            string.Empty,
            "家庭日筹备",
            string.Empty,
            "大型家庭活动",
            [
                new CreateEventWorkflowStageInput(string.Empty, "策划", true),
                new CreateEventWorkflowStageInput("Delivery", "执行", false)
            ]), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(groupId, result.Value!.OwnerGroupId);
        Assert.Equal("家庭日筹备", result.Value.Name.En);
        Assert.Equal("家庭日筹备", result.Value.Name.Zh);
        Assert.Collection(result.Value.Stages,
            stage =>
            {
                Assert.Equal("stage_1", stage.Key);
                Assert.True(stage.RequiresApproval);
            },
            stage =>
            {
                Assert.Equal("stage_2", stage.Key);
                Assert.False(stage.RequiresApproval);
            });
        Assert.Single(await dbContext.EventWorkflowTemplates.ToListAsync());
    }

    [Fact]
    public async Task CreateCustomTemplate_AsRegularMember_IsForbidden()
    {
        using var dbContext = CreateDbContext();
        var groupId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupId, memberId, Arg.Any<CancellationToken>()).Returns(false);
        var handler = new CreateEventWorkflowTemplateCommandHandler(dbContext, authorization);

        var result = await handler.Handle(new CreateEventWorkflowTemplateCommand(
            groupId,
            memberId,
            "Custom",
            "自定义",
            string.Empty,
            string.Empty,
            [new CreateEventWorkflowStageInput("Plan", "策划", false)]), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Empty(await dbContext.EventWorkflowTemplates.ToListAsync());
    }

    [Fact]
    public async Task ListTemplates_ReturnsGlobalAndCurrentGroupTemplatesOnly()
    {
        using var dbContext = CreateDbContext();
        var groupId = Guid.NewGuid();
        var otherGroupId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var global = CreateTemplate("camp", CampDefinition);
        var currentGroup = CreateTemplate("custom_current", CampDefinition);
        currentGroup.OwnerGroupId = groupId;
        var otherGroup = CreateTemplate("custom_other", CampDefinition);
        otherGroup.OwnerGroupId = otherGroupId;
        dbContext.EventWorkflowTemplates.AddRange(global, currentGroup, otherGroup);
        await dbContext.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsApprovedMemberAsync(groupId, memberId, Arg.Any<CancellationToken>()).Returns(true);
        var handler = new ListEventWorkflowTemplatesQueryHandler(dbContext, authorization);

        var result = await handler.Handle(new ListEventWorkflowTemplatesQuery(groupId, memberId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var templates = Assert.IsAssignableFrom<IReadOnlyList<Alife.Application.Events.Dtos.EventWorkflowTemplateDto>>(result.Value);
        Assert.Equal(["camp", "custom_current"], templates.Select(x => x.Code));
        Assert.DoesNotContain(templates, x => x.Code == "custom_other");
    }

    [Fact]
    public async Task InitializeCampWorkflow_CreatesVersionedStepsAndOutputPlaceholders()
    {
        using var dbContext = CreateDbContext();
        var groupId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var groupEvent = CreateEvent(groupId, leaderId);
        dbContext.GroupEvents.Add(groupEvent);
        dbContext.EventWorkflowTemplates.Add(CreateTemplate("camp", CampDefinition));
        await dbContext.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);
        var handler = new InitializeEventWorkflowCommandHandler(dbContext, authorization);

        var result = await handler.Handle(
            new InitializeEventWorkflowCommand(groupEvent.Id, leaderId, "camp"), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("camp", result.Value!.Template.Code);
        Assert.Equal(2, result.Value.Steps.Count);
        Assert.Equal("proposal", result.Value.CurrentStepKey);
        Assert.Contains(result.Value.Steps.SelectMany(x => x.Artifacts), x => x.ArtifactType == "budget" && x.IsRequired);
        Assert.Equal(2, await dbContext.EventWorkflowSteps.CountAsync());
        Assert.Equal(3, await dbContext.EventArtifacts.CountAsync());
    }

    [Fact]
    public async Task InitializeOutreachWorkflow_PreservesPrivateContactOutputs()
    {
        using var dbContext = CreateDbContext();
        var groupId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var groupEvent = CreateEvent(groupId, leaderId);
        dbContext.GroupEvents.Add(groupEvent);
        dbContext.EventWorkflowTemplates.Add(CreateTemplate("outreach", OutreachDefinition));
        await dbContext.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>()).Returns(true);
        var handler = new InitializeEventWorkflowCommandHandler(dbContext, authorization);

        var result = await handler.Handle(
            new InitializeEventWorkflowCommand(groupEvent.Id, leaderId, "outreach"), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var contactList = Assert.Single(result.Value!.Steps.SelectMany(x => x.Artifacts), x => x.ArtifactType == "new_contact_list");
        Assert.Equal(FileAssetVisibility.MemberPrivate, contactList.Visibility);
    }

    [Fact]
    public async Task RamIntegration_ApprovesManagedOutputAndCompletesWorkflow()
    {
        using var dbContext = CreateDbContext();
        var now = DateTime.UtcNow;
        var auditorId = Guid.NewGuid();
        var run = new EventWorkflowRun
        {
            Id = Guid.NewGuid(), EventId = Guid.NewGuid(), TemplateId = Guid.NewGuid(), TemplateVersion = 1,
            TemplateSnapshotJson = CampDefinition, StartedUtc = now, UpdatedUtc = now,
            Steps =
            [
                new EventWorkflowStep
                {
                    Id = Guid.NewGuid(), StepKey = "risk_assessment", SortOrder = 1, NameEn = "RAM", NameZh = "风险评估",
                    IsRequired = true, RequiresApproval = true, IntegrationKey = "ram", CreatedUtc = now, UpdatedUtc = now,
                    Artifacts =
                    [
                        new EventArtifact
                        {
                            Id = Guid.NewGuid(), EventId = Guid.Empty, ArtifactType = "ram", TitleEn = "RAM", TitleZh = "风险评估",
                            IsRequired = true, Visibility = FileAssetVisibility.GroupVisible, DataJson = "{}",
                            CreatedByMemberId = Guid.NewGuid(), CreatedUtc = now, UpdatedUtc = now
                        }
                    ]
                }
            ]
        };
        run.Steps.Single().Artifacts.Single().EventId = run.EventId;
        dbContext.EventWorkflowRuns.Add(run);
        await dbContext.SaveChangesAsync();

        await EventWorkflowIntegration.SyncRamAsync(
            dbContext, run.EventId, EventRamStatus.Approved, "{\"leaderConfirmed\":true}", auditorId, now, CancellationToken.None);
        await dbContext.SaveChangesAsync();

        Assert.Equal(EventWorkflowRunStatus.Completed, run.Status);
        Assert.Equal(EventWorkflowStepStatus.Completed, run.Steps.Single().Status);
        Assert.Equal(EventArtifactStatus.Approved, run.Steps.Single().Artifacts.Single().Status);
        Assert.Equal(auditorId, run.Steps.Single().Artifacts.Single().ApprovedByMemberId);
    }

    [Fact]
    public async Task GetWorkflow_HidesPrivateOutputsFromRegularGroupMembers()
    {
        using var dbContext = CreateDbContext();
        var groupId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var groupEvent = CreateEvent(groupId, leaderId);
        var template = CreateTemplate("outreach", OutreachDefinition);
        var now = DateTime.UtcNow;
        var run = new EventWorkflowRun
        {
            Id = Guid.NewGuid(), EventId = groupEvent.Id, TemplateId = template.Id, TemplateVersion = 1,
            TemplateSnapshotJson = OutreachDefinition, Template = template, StartedUtc = now, UpdatedUtc = now
        };
        var step = new EventWorkflowStep
        {
            Id = Guid.NewGuid(), WorkflowRunId = run.Id, StepKey = "follow_up", SortOrder = 1,
            NameEn = "Follow-up", NameZh = "跟进", IsRequired = true, CreatedUtc = now, UpdatedUtc = now
        };
        step.Artifacts.Add(new EventArtifact
        {
            Id = Guid.NewGuid(), EventId = groupEvent.Id, WorkflowStepId = step.Id, ArtifactType = "event_review",
            TitleEn = "Review", TitleZh = "回顾", Visibility = FileAssetVisibility.GroupVisible,
            DataJson = "{}", CreatedByMemberId = leaderId, CreatedUtc = now, UpdatedUtc = now
        });
        step.Artifacts.Add(new EventArtifact
        {
            Id = Guid.NewGuid(), EventId = groupEvent.Id, WorkflowStepId = step.Id, ArtifactType = "new_contact_list",
            TitleEn = "New contacts", TitleZh = "新朋友名单", Visibility = FileAssetVisibility.MemberPrivate,
            DataJson = "{\"names\":[\"Private Person\"]}", CreatedByMemberId = leaderId, CreatedUtc = now, UpdatedUtc = now
        });
        run.Steps.Add(step);
        dbContext.GroupEvents.Add(groupEvent);
        dbContext.EventWorkflowTemplates.Add(template);
        dbContext.EventWorkflowRuns.Add(run);
        await dbContext.SaveChangesAsync();
        var authorization = Substitute.For<IGroupAuthorizationService>();
        authorization.IsApprovedMemberAsync(groupId, memberId, Arg.Any<CancellationToken>()).Returns(true);
        var handler = new GetEventWorkflowQueryHandler(dbContext, authorization);

        var result = await handler.Handle(new GetEventWorkflowQuery(groupEvent.Id, memberId), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var visibleArtifact = Assert.Single(result.Value!.Steps.Single().Artifacts);
        Assert.Equal("event_review", visibleArtifact.ArtifactType);
        Assert.DoesNotContain("Private Person", visibleArtifact.DataJson, StringComparison.Ordinal);
    }

    private static AlifeDbContext CreateDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }

    private static GroupEvent CreateEvent(Guid groupId, Guid leaderId)
    {
        var now = DateTime.UtcNow;
        return new GroupEvent
        {
            Id = Guid.NewGuid(), GroupId = groupId, CreatedByMemberId = leaderId,
            TitleEn = "Event", TitleZh = "活动", StartDate = now.AddDays(10), EndDate = now.AddDays(12),
            EventDataJson = "{}", CreatedUtc = now, UpdatedUtc = now,
            RamAssessment = new EventRamAssessment { RamDataJson = "{}", CreatedUtc = now, UpdatedUtc = now }
        };
    }

    private static EventWorkflowTemplate CreateTemplate(string code, string definitionJson) => new()
    {
        Id = Guid.NewGuid(), Code = code, Version = 1, NameEn = code, NameZh = code,
        DescriptionEn = code, DescriptionZh = code, DefinitionJson = definitionJson, IsActive = true,
        CreatedUtc = DateTime.UtcNow, UpdatedUtc = DateTime.UtcNow
    };

    private const string CampDefinition = """
        {"stages":[
          {"key":"proposal","name":{"en":"Proposal","zh":"提案"},"required":true,"requiresApproval":true,"integrationKey":null,
           "artifacts":[{"type":"event_plan","title":{"en":"Plan","zh":"计划"},"required":true,"visibility":"groupVisible"},{"type":"budget","title":{"en":"Budget","zh":"预算"},"required":true,"visibility":"groupVisible"}]},
          {"key":"risk_assessment","name":{"en":"Risk assessment","zh":"风险评估"},"required":true,"requiresApproval":true,"integrationKey":"ram",
           "artifacts":[{"type":"ram","title":{"en":"RAM","zh":"风险评估"},"required":true,"visibility":"groupVisible"}]}
        ]}
        """;

    private const string OutreachDefinition = """
        {"stages":[
          {"key":"follow_up","name":{"en":"Follow-up","zh":"跟进"},"required":true,"requiresApproval":true,"integrationKey":null,
           "artifacts":[{"type":"new_contact_list","title":{"en":"New contacts","zh":"新朋友名单"},"required":true,"visibility":"memberPrivate"}]}
        ]}
        """;
}
