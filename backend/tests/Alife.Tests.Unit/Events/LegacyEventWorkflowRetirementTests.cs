using Alife.Api.Controllers;
using Alife.Application.Abstractions.Identity;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public sealed class LegacyEventWorkflowRetirementTests
{
    private readonly EventsController _controller = new(
        Substitute.For<IMediator>(),
        Substitute.For<ICurrentMemberAccessor>());

    [Fact]
    public void Fixed_workflow_templates_are_no_longer_an_active_entry_point()
    {
        var result = _controller.ListWorkflowTemplates(null, CancellationToken.None);

        AssertRetired(result);
    }

    [Fact]
    public void Fixed_workflow_cannot_be_created_for_an_event()
    {
        var result = _controller.InitializeWorkflow(
            Guid.NewGuid(),
            new EventsController.InitializeEventWorkflowRequest("camp"),
            CancellationToken.None);

        AssertRetired(result);
    }

    [Fact]
    public void Fixed_workflow_steps_cannot_be_advanced()
    {
        var result = _controller.UpdateWorkflowStep(
            Guid.NewGuid(),
            Guid.NewGuid(),
            new EventsController.UpdateEventWorkflowStepRequest(
                EventWorkflowStepStatus.Completed,
                null,
                null),
            CancellationToken.None);

        AssertRetired(result);
    }

    [Fact]
    public void Historical_workflow_artifacts_cannot_be_added_or_changed()
    {
        var create = _controller.CreateWorkflowArtifact(
            Guid.NewGuid(),
            new EventsController.CreateEventArtifactRequest(
                null, "plan", "Plan", "计划", true, FileAssetVisibility.GroupVisible, null, "{}"),
            CancellationToken.None);
        var update = _controller.UpdateWorkflowArtifact(
            Guid.NewGuid(),
            Guid.NewGuid(),
            new EventsController.UpdateEventArtifactRequest(
                "Plan", "计划", EventArtifactStatus.Draft, FileAssetVisibility.GroupVisible, null, "{}"),
            CancellationToken.None);

        AssertRetired(create);
        AssertRetired(update);
    }

    private static void AssertRetired(IActionResult result)
    {
        var objectResult = Assert.IsType<ObjectResult>(result);
        Assert.Equal(StatusCodes.Status410Gone, objectResult.StatusCode);
        var details = Assert.IsType<ProblemDetails>(objectResult.Value);
        Assert.Contains("composed preparation plan", details.Detail);
    }
}
