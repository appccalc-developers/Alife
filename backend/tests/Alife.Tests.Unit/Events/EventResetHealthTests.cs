using Alife.Api;
using Alife.Api.Controllers;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using NSubstitute;

namespace Alife.Tests.Unit.Events;

public sealed class EventResetHealthTests
{
    [Fact]
    public async Task VerifiedEmptyReset_IsHealthyAndUsesDedicatedToken()
    {
        var probe = Substitute.For<IEventResetDataProbe>();
        probe.ReadAsync(Arg.Any<CancellationToken>())
            .Returns(new EventResetDataState(true, false, 0, 0));
        var state = State(probe, rollbackHold: "false");

        Assert.True(state.IsHealthIdentity("Bearer health-secret"));
        Assert.False(state.IsHealthIdentity("Bearer freeze-secret"));
        var status = await state.ReadAsync(CancellationToken.None);

        Assert.True(status.Healthy);
        Assert.False(status.RollbackHold);
        Assert.Equal("2.0.0", status.SchemaEpoch);
        Assert.Equal("freeze-42", status.DataEpoch);
        Assert.Equal("reset-42", status.ResetRunId);
        Assert.False(status.DestructiveMigrationApplied);
        Assert.False(status.FinalizationBlocksDeployment);
        Assert.False(status.FinalReleaseBlocksDeployment);
    }

    [Theory]
    [InlineData("true", true, 0L, 0L)]
    [InlineData("false", false, 1L, 1L)]
    [InlineData("false", false, 0L, 3L)]
    [InlineData(null, false, 0L, 0L)]
    public async Task RollbackHold_DataOrMissingHoldConfiguration_FailsClosed(
        string? rollbackHold,
        bool inventoryRecognized,
        long roots,
        long instances)
    {
        var probe = Substitute.For<IEventResetDataProbe>();
        probe.ReadAsync(Arg.Any<CancellationToken>())
            .Returns(new EventResetDataState(inventoryRecognized, false, roots, instances));

        var status = await State(probe, rollbackHold).ReadAsync(CancellationToken.None);

        Assert.False(status.Healthy);
    }

    [Fact]
    public async Task IncompleteFinalization_BlocksDeploymentAndHealth()
    {
        var probe = Substitute.For<IEventResetDataProbe>();
        probe.ReadAsync(Arg.Any<CancellationToken>())
            .Returns(new EventResetDataState(true, true, 0, 0));

        var status = await State(probe, "false", "in-progress").ReadAsync(CancellationToken.None);

        Assert.False(status.Healthy);
        Assert.True(status.FinalizationBlocksDeployment);
        Assert.True(status.DestructiveMigrationApplied);
    }

    [Fact]
    public async Task DataEpochDifferentFromVerifiedResetEpoch_FailsClosed()
    {
        var probe = Substitute.For<IEventResetDataProbe>();
        probe.ReadAsync(Arg.Any<CancellationToken>())
            .Returns(new EventResetDataState(true, false, 0, 0));
        var configuration = ValidSettings(rollbackHold: "false");
        configuration["EVENT_DATA_EPOCH"] = "different-epoch";

        var status = await new EventResetHealthState(
            new ConfigurationBuilder().AddInMemoryCollection(configuration).Build(),
            probe).ReadAsync(CancellationToken.None);

        Assert.False(status.Healthy);
        Assert.False(status.VerifiedStateConfigured);
    }

    [Fact]
    public async Task RollbackState_FailsClosedEvenIfHoldFlagWasCleared()
    {
        var probe = Substitute.For<IEventResetDataProbe>();
        probe.ReadAsync(Arg.Any<CancellationToken>())
            .Returns(new EventResetDataState(true, true, 0, 0));

        var status = await State(probe, "false", rollbackState: "in-progress")
            .ReadAsync(CancellationToken.None);

        Assert.False(status.Healthy);
        Assert.True(status.RollbackHold);
    }

    [Fact]
    public async Task AppliedMigration_BlocksOrdinaryDeployUntilFinalReleaseCompletes()
    {
        var probe = Substitute.For<IEventResetDataProbe>();
        probe.ReadAsync(Arg.Any<CancellationToken>())
            .Returns(new EventResetDataState(true, true, 0, 0));

        var verifying = await State(probe, "false", finalReleaseState: "verifying")
            .ReadAsync(CancellationToken.None);
        var complete = await State(probe, "false", finalReleaseState: "complete")
            .ReadAsync(CancellationToken.None);

        Assert.True(verifying.FinalReleaseBlocksDeployment);
        Assert.False(complete.FinalReleaseBlocksDeployment);
    }

    [Fact]
    public async Task Controller_RequiresDedicatedTokenAndReturnsPrivateNoStore()
    {
        var probe = Substitute.For<IEventResetDataProbe>();
        probe.ReadAsync(Arg.Any<CancellationToken>())
            .Returns(new EventResetDataState(true, true, 0, 0));
        var controller = new AdminEventResetHealthController(State(probe, "false"))
        {
            ControllerContext = new ControllerContext { HttpContext = new DefaultHttpContext() }
        };

        var forbidden = Assert.IsType<ObjectResult>(await controller.Get(CancellationToken.None));
        Assert.Equal(StatusCodes.Status403Forbidden, forbidden.StatusCode);

        controller.ControllerContext.HttpContext.Request.Headers.Authorization = "Bearer health-secret";
        var ok = Assert.IsType<OkObjectResult>(await controller.Get(CancellationToken.None));

        Assert.Equal(StatusCodes.Status200OK, ok.StatusCode);
        Assert.Equal("private, no-store", controller.Response.Headers.CacheControl.ToString());
    }

    private static EventResetHealthState State(
        IEventResetDataProbe probe,
        string? rollbackHold,
        string? finalizeState = null,
        string? rollbackState = null,
        string? finalReleaseState = null)
    {
        var values = ValidSettings(rollbackHold, finalizeState, rollbackState, finalReleaseState);
        return new EventResetHealthState(new ConfigurationBuilder().AddInMemoryCollection(values).Build(), probe);
    }

    private static Dictionary<string, string?> ValidSettings(
        string? rollbackHold,
        string? finalizeState = null,
        string? rollbackState = null,
        string? finalReleaseState = null)
        => new()
        {
            ["EVENT_SCHEMA_EPOCH"] = "2.0.0",
            ["EVENT_DATA_EPOCH"] = "freeze-42",
            ["EVENT_RESET_LAST_VERIFIED_RUN_ID"] = "reset-42",
            ["EVENT_RESET_LAST_VERIFIED_STATE"] = "verified",
            ["EVENT_RESET_LAST_VERIFIED_SCHEMA_EPOCH"] = "2.0.0",
            ["EVENT_RESET_LAST_VERIFIED_EVIDENCE_RUN_ID"] = "12345",
            ["EVENT_RESET_LAST_VERIFIED_CODE_SHA"] = new string('a', 40),
            ["EVENT_RESET_LAST_VERIFIED_FINGERPRINT"] = new string('b', 64),
            ["EVENT_RESET_LAST_VERIFIED_FILE_MANIFEST_HASH"] = new string('c', 64),
            ["EVENT_RESET_LAST_VERIFIED_BACKUP_REFERENCE"] = "/subscriptions/sub/resourceGroups/rg/providers/Microsoft.Sql/servers/sql/databases/recovery",
            ["EVENT_RESET_LAST_VERIFIED_EPOCH"] = "freeze-42",
            ["EVENT_RESET_ROLLBACK_HOLD"] = rollbackHold,
            ["EVENT_RESET_FINALIZE_STATE"] = finalizeState,
            ["EVENT_RESET_ROLLBACK_STATE"] = rollbackState,
            ["EVENT_RESET_FINAL_RELEASE_STATE"] = finalReleaseState,
            ["EVENT_RESET_FINALIZE_HEALTH_TOKEN"] = "health-secret",
            ["EVENT_RESET_FREEZE_STATUS_TOKEN"] = "freeze-secret"
        };
}
