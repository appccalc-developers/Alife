using Alife.Api;
using Alife.Api.Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public sealed class EventWriteFreezeTests
{
    [Fact]
    public void ProductionConfiguration_FailsClosedWhenEpochSettingsAreMissing()
    {
        var status = State([], Environments.Production).GetStatus();

        Assert.True(status.Frozen);
        Assert.False(status.ConfigurationValid);
        Assert.False(status.Ready);
    }

    [Fact]
    public void FrozenConfiguration_ReportsWorkflowAliasesAndAuthenticatesMaintenanceIdentity()
    {
        var state = State(new Dictionary<string, string?>
        {
            ["EVENT_RUNTIME_ENVIRONMENT"] = "production",
            ["EVENT_SCHEMA_EPOCH"] = "2.0.0",
            ["EVENT_DATA_EPOCH"] = "reset-42",
            ["EVENT_WRITE_MODE"] = "frozen",
            ["EVENT_WRITE_FREEZE_EPOCH"] = "reset-42",
            ["EVENT_WRITE_FREEZE_RETRY_AFTER_SECONDS"] = "120",
            ["EVENT_RESET_FREEZE_STATUS_TOKEN"] = "maintenance-secret"
        }, Environments.Production);

        state.AcknowledgeScheduledJob(EventScheduledJob.RamSync);
        state.AcknowledgeScheduledJob(EventScheduledJob.RegistrationExpiry);
        var status = state.GetStatus();
        Assert.True(status.Ready);
        Assert.True(status.Frozen);
        Assert.Equal("reset-42", status.Epoch);
        Assert.Equal(status.Epoch, status.ResetEpoch);
        Assert.Equal("2.0.0", status.SchemaVersion);
        Assert.Equal(status.SchemaVersion, status.SchemaEpoch);
        Assert.True(status.ScheduledJobsAcknowledged);
        Assert.Equal(0, status.ActiveMutations);
        Assert.Equal(120, status.RetryAfterSeconds);
        Assert.True(state.IsMaintenanceIdentity("Bearer maintenance-secret"));
        Assert.False(state.IsMaintenanceIdentity("Bearer wrong"));
    }

    [Fact]
    public void FrozenConfiguration_IsNotReadyUntilBothScheduledJobsAcknowledgeFreezeParticipation()
    {
        var state = FrozenState();

        Assert.False(state.GetStatus().ScheduledJobsAcknowledged);
        Assert.False(state.GetStatus().Ready);

        state.AcknowledgeScheduledJob(EventScheduledJob.RamSync);
        Assert.False(state.GetStatus().ScheduledJobsAcknowledged);
        Assert.False(state.GetStatus().Ready);

        state.AcknowledgeScheduledJob(EventScheduledJob.RegistrationExpiry);
        Assert.True(state.GetStatus().ScheduledJobsAcknowledged);
        Assert.True(state.GetStatus().Ready);
    }

    [Fact]
    public void InFlightMutation_DrainsBeforeFrozenRuntimeBecomesReady()
    {
        var values = new Dictionary<string, string?>
        {
            ["EVENT_RUNTIME_ENVIRONMENT"] = "production",
            ["EVENT_SCHEMA_EPOCH"] = "2.0.0",
            ["EVENT_DATA_EPOCH"] = "event-data-current",
            ["EVENT_WRITE_MODE"] = "open"
        };
        var configuration = new ConfigurationBuilder().AddInMemoryCollection(values).Build();
        var state = State(configuration, Environments.Production);
        state.AcknowledgeScheduledJob(EventScheduledJob.RamSync);
        state.AcknowledgeScheduledJob(EventScheduledJob.RegistrationExpiry);

        var mutation = state.TryEnterMutation();
        Assert.NotNull(mutation);
        Assert.Equal(1, state.GetStatus().ActiveMutations);

        configuration["EVENT_WRITE_MODE"] = "frozen";
        configuration["EVENT_WRITE_FREEZE_EPOCH"] = "reset-42";
        configuration["EVENT_DATA_EPOCH"] = "reset-42";
        var draining = state.GetStatus();
        Assert.True(draining.Frozen);
        Assert.False(draining.Ready);
        Assert.Null(state.TryEnterMutation());
        Assert.Equal(1, state.GetStatus().ActiveMutations);

        mutation.Dispose();
        mutation.Dispose();
        var drained = state.GetStatus();
        Assert.Equal(0, drained.ActiveMutations);
        Assert.True(drained.Ready);
    }

    [Fact]
    public async Task ResetStatus_ReturnsProbedTargetIdentityOnlyToMaintenanceIdentity()
    {
        const string targetIdentityHash = "72012d925dc4a45f0913169aed80a12cd622cb7111ad42eab2559948e3230bf1";
        var state = FrozenState();
        state.AcknowledgeScheduledJob(EventScheduledJob.RamSync);
        state.AcknowledgeScheduledJob(EventScheduledJob.RegistrationExpiry);
        var probe = Substitute.For<IEventResetTargetIdentityProbe>();
        probe.ReadAsync(Arg.Any<CancellationToken>()).Returns(targetIdentityHash);
        var controller = ResetStatusController(state, probe);

        var forbidden = Assert.IsType<ObjectResult>(await controller.Get(CancellationToken.None));
        Assert.Equal(StatusCodes.Status403Forbidden, forbidden.StatusCode);
        Assert.Empty(probe.ReceivedCalls());

        controller.Request.Headers.Authorization = "Bearer maintenance-secret";
        var ok = Assert.IsType<OkObjectResult>(await controller.Get(CancellationToken.None));
        var status = Assert.IsType<EventResetRuntimeStatus>(ok.Value);
        Assert.Equal(targetIdentityHash, status.TargetIdentityHash);
        Assert.Equal("private, no-store", controller.Response.Headers.CacheControl.ToString());
        await probe.Received(1).ReadAsync(Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ResetStatus_TargetProbeFailureReturnsGenericUnavailableResponse()
    {
        var probe = Substitute.For<IEventResetTargetIdentityProbe>();
        probe.ReadAsync(Arg.Any<CancellationToken>()).Returns(_ =>
            Task.FromException<string>(new InvalidOperationException(
                "Server=tcp:private.database.windows.net;Password=do-not-return")));
        var controller = ResetStatusController(FrozenState(), probe);
        controller.Request.Headers.Authorization = "Bearer maintenance-secret";

        var unavailable = Assert.IsType<ObjectResult>(await controller.Get(CancellationToken.None));

        Assert.Equal(StatusCodes.Status503ServiceUnavailable, unavailable.StatusCode);
        var response = System.Text.Json.JsonSerializer.Serialize(unavailable.Value);
        Assert.DoesNotContain("private.database.windows.net", response, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("do-not-return", response, StringComparison.OrdinalIgnoreCase);
        Assert.Equal("private, no-store", controller.Response.Headers.CacheControl.ToString());
    }

    [Theory]
    [InlineData("POST", "/api/groups/11111111-1111-1111-1111-111111111111/events", true)]
    [InlineData("POST", "/api/groups/11111111-1111-1111-1111-111111111111/event-plans/compose", true)]
    [InlineData("POST", "/api/groups/11111111-1111-1111-1111-111111111111/event-series", true)]
    [InlineData("PUT", "/api/event-series/11111111-1111-1111-1111-111111111111", true)]
    [InlineData("POST", "/api/groups/11111111-1111-1111-1111-111111111111/event-venues/22222222-2222-2222-2222-222222222222/weekly", true)]
    [InlineData("PUT", "/api/groups/11111111-1111-1111-1111-111111111111/venues/22222222-2222-2222-2222-222222222222", true)]
    [InlineData("PATCH", "/api/events/11111111-1111-1111-1111-111111111111", true)]
    [InlineData("DELETE", "/api/event-package-delegations/11111111-1111-1111-1111-111111111111", true)]
    [InlineData("PUT", "/api/admin/event-templates/shared-meal", true)]
    [InlineData("POST", "/api/admin/churches/11111111-1111-1111-1111-111111111111/ram-policies", true)]
    [InlineData("GET", "/api/events/11111111-1111-1111-1111-111111111111", false)]
    [InlineData("POST", "/api/pages", false)]
    public void EventMutationClassification_IsScopedToEventWrites(string method, string path, bool expected)
    {
        var context = new DefaultHttpContext();
        context.Request.Method = method;
        context.Request.Path = path;
        Assert.Equal(expected, EventWriteFreezeState.IsEventMutation(context.Request));
    }

    private static EventWriteFreezeState State(Dictionary<string, string?> values, string environmentName)
        => State(new ConfigurationBuilder().AddInMemoryCollection(values).Build(), environmentName);

    private static EventWriteFreezeState State(IConfiguration configuration, string environmentName)
    {
        var host = Substitute.For<IHostEnvironment>();
        host.EnvironmentName.Returns(environmentName);
        return new(configuration, host);
    }

    private static EventWriteFreezeState FrozenState() => State(new Dictionary<string, string?>
    {
        ["EVENT_RUNTIME_ENVIRONMENT"] = "production",
        ["EVENT_SCHEMA_EPOCH"] = "2.0.0",
        ["EVENT_DATA_EPOCH"] = "reset-42",
        ["EVENT_WRITE_MODE"] = "frozen",
        ["EVENT_WRITE_FREEZE_EPOCH"] = "reset-42",
        ["EVENT_RESET_FREEZE_STATUS_TOKEN"] = "maintenance-secret"
    }, Environments.Production);

    private static AdminEventResetStatusController ResetStatusController(
        EventWriteFreezeState state,
        IEventResetTargetIdentityProbe probe) => new(state, probe)
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };
}
