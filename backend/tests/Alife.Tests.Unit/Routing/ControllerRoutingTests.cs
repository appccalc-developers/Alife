using Alife.Api.Controllers;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Alife.Tests.Unit.Routing;

public sealed class ControllerRoutingTests
{
    private const string EventId = "11111111-1111-1111-1111-111111111111";
    private const string TaskId = "22222222-2222-2222-2222-222222222222";

    [Fact]
    public async Task AllControllers_CanBuildRoutesAndMatchOnboardingCapabilities()
    {
        await using var app = CreateApp();
        var context = await MatchAsync(app, "GET", "/api/onboarding/capabilities");

        AssertAction<OnboardingController>(context, nameof(OnboardingController.Capabilities));
    }

    [Theory]
    [InlineData("submit-completion")]
    [InlineData("withdraw-completion")]
    [InlineData("approve")]
    [InlineData("return")]
    public async Task TaskActions_MatchExistingUrlsAndBindOperation(string operation)
    {
        await using var app = CreateApp();
        var context = await MatchAsync(app, "POST", $"/api/events/{EventId}/tasks/{TaskId}/{operation}");

        AssertAction<EventOperationsController>(context, nameof(EventOperationsController.ActOnTask));
        Assert.Equal(operation, context.Request.RouteValues["taskAction"]);
        Assert.NotEmpty(context.GetEndpoint()!.Metadata.GetOrderedMetadata<IAuthorizeData>());
    }

    [Theory]
    [InlineData(EventId, TaskId, "unknown")]
    [InlineData("invalid-event", TaskId, "approve")]
    [InlineData(EventId, "invalid-task", "approve")]
    public async Task TaskActions_RejectUnknownOperationsAndInvalidIds(string eventId, string taskId, string operation)
    {
        await using var app = CreateApp();
        var context = await MatchAsync(app, "POST", $"/api/events/{eventId}/tasks/{taskId}/{operation}");

        Assert.Null(context.GetEndpoint());
    }

    [Theory]
    [InlineData("snapshot-draft")]
    [InlineData("request-confirmation")]
    [InlineData("confirm")]
    [InlineData("submit")]
    [InlineData("approve")]
    [InlineData("return")]
    [InlineData("request-review")]
    public async Task RamActions_MatchOperationInsteadOfControllerMethodName(string operation)
    {
        await using var app = CreateApp();
        var context = await MatchAsync(app, "POST", $"/api/events/{EventId}/ram/actions/{operation}");

        AssertAction<EventRamGovernanceController>(context, nameof(EventRamGovernanceController.Act));
        Assert.Equal(operation, context.Request.RouteValues["ramAction"]);
        Assert.NotEmpty(context.GetEndpoint()!.Metadata.GetOrderedMetadata<IAuthorizeData>());
    }

    [Theory]
    [InlineData("pause")]
    [InlineData("resume")]
    [InlineData("revoke")]
    [InlineData("rotate")]
    public async Task JoinInviteActions_MatchOperationInsteadOfControllerMethodName(string operation)
    {
        await using var app = CreateApp();
        var context = await MatchAsync(app, "POST", $"/api/groups/{EventId}/join-invite/{operation}");

        AssertAction<IdentityManagementController>(context, nameof(IdentityManagementController.ChangeJoinInvite));
        Assert.Equal(operation, context.Request.RouteValues["inviteAction"]);
        Assert.NotEmpty(context.GetEndpoint()!.Metadata.GetOrderedMetadata<IAuthorizeData>());
    }

    private static WebApplication CreateApp()
    {
        var builder = WebApplication.CreateBuilder();
        builder.Services.AddControllers().AddApplicationPart(typeof(OnboardingController).Assembly);
        return builder.Build();
    }

    private static async Task<DefaultHttpContext> MatchAsync(WebApplication app, string method, string path)
    {
        var pipeline = new ApplicationBuilder(app.Services);
        pipeline.UseRouting();
        // Exercise real MVC route discovery and matching without running business
        // mutations or requiring a database, credentials, or a listening server.
        pipeline.Run(_ => Task.CompletedTask);
        pipeline.UseEndpoints(endpoints => endpoints.MapControllers());

        var context = new DefaultHttpContext { RequestServices = app.Services };
        context.Request.Method = method;
        context.Request.Path = path;
        await pipeline.Build()(context);
        return context;
    }

    private static void AssertAction<TController>(HttpContext context, string actionName)
    {
        var action = context.GetEndpoint()?.Metadata.GetMetadata<ControllerActionDescriptor>();
        Assert.NotNull(action);
        Assert.Equal(typeof(TController), action.ControllerTypeInfo.AsType());
        Assert.Equal(actionName, action.ActionName);
    }
}
