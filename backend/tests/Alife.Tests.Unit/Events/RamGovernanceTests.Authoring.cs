using Alife.Application.Common.Models;
using Alife.Application.Events.Services;
using Microsoft.EntityFrameworkCore;

namespace Alife.Tests.Unit.Events;

public sealed partial class RamGovernanceTests
{
    [Fact]
    public async Task Authoring_PrecreationRequiresGroupAuthority_AndCheckHasNoWrites()
    {
        using var f = await Fixture.Create(); await f.Publish();
        Assert.Equal(AppResultStatus.Forbidden, (await f.Service.AuthoringContextAsync(null, f.Group, f.Onsite, default)).Status);
        Assert.Equal(AppResultStatus.Forbidden, (await f.Service.AuthoringContextAsync(f.Event, null, f.Other, default)).Status);
        var draft = Draft(Policy()); draft.Hazards[0].ControlMeasures = new(); draft.Hazards[0].RiskScore = 999;
        var result = await f.Service.CheckDraftAsync(new(null, f.Group, RamEvaluator.Serialize(draft)), f.Author, default);
        Assert.True(result.IsSuccess, result.Message);
        Assert.Contains(result.Value!.Issues, x => x.Field.EndsWith(".controlMeasures") && x.Message.Zh.Contains("控制措施"));
        Assert.NotEqual(999, result.Value.Draft.Hazards[0].RiskScore);
        Assert.Equal(999, draft.Hazards[0].RiskScore);
        Assert.Empty(await f.Db.EventRamAssessments.ToListAsync());
        Assert.Empty(await f.Db.EventRamRevisions.ToListAsync());
        Assert.False(f.Db.ChangeTracker.HasChanges());
    }

    [Fact]
    public async Task Authoring_SavedDraftChecksDoNotChangeSignedContent_AndRejectForeignPolicy()
    {
        using var f = await Fixture.Create(); await f.Publish(); await f.Save(f.PolicyId);
        var before = await f.Db.EventRamAssessments.AsNoTracking().SingleAsync();
        var context = await f.Service.AuthoringContextAsync(f.Event, null, f.Author, default);
        Assert.True(context.IsSuccess);
        Assert.Equal(AppResultStatus.ValidationError, (await f.Service.CheckDraftAsync(new(f.Event, null, "{}", Guid.NewGuid()), f.Author, default)).Status);
        var check = await f.Service.CheckDraftAsync(new(f.Event, null, "{}"), f.Author, default);
        Assert.True(check.IsSuccess);
        var after = await f.Db.EventRamAssessments.AsNoTracking().SingleAsync();
        Assert.Equal(before.RamDataJson, after.RamDataJson); Assert.Equal(before.ConcurrencyToken, after.ConcurrencyToken);
        Assert.Equal(before.Status, after.Status); Assert.Equal(before.CurrentRevisionId, after.CurrentRevisionId);
        Assert.False(f.Db.ChangeTracker.HasChanges());
    }
}
