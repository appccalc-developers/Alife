using Alife.Application.Events.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;

namespace Alife.Tests.Unit.Events;

public class EventLifecyclePolicyTests
{
    [Fact]
    public void CanCreateEnrollment_AllowsOpenEnrollmentWindow()
    {
        var now = new DateTime(2026, 7, 22, 0, 0, 0, DateTimeKind.Utc);
        var groupEvent = EventEndingAt(now.AddDays(2), "2026-07-23T00:00:00Z", 20);

        var allowed = EventLifecyclePolicy.CanCreateEnrollment(groupEvent, now, out var error);

        Assert.True(allowed);
        Assert.Empty(error);
    }

    [Fact]
    public void CanCreateEnrollment_RejectsClosedEnrollmentWindow()
    {
        var now = new DateTime(2026, 7, 22, 0, 0, 0, DateTimeKind.Utc);
        var groupEvent = EventEndingAt(now.AddDays(2), "2026-07-21T23:59:59Z", 20);

        var allowed = EventLifecyclePolicy.CanCreateEnrollment(groupEvent, now, out var error);

        Assert.False(allowed);
        Assert.Equal("Enrollment is closed for this event.", error);
    }

    [Fact]
    public void CanCreateEnrollment_RejectsEventWithoutEnrollmentConfiguration()
    {
        var now = new DateTime(2026, 7, 22, 0, 0, 0, DateTimeKind.Utc);
        var groupEvent = EventEndingAt(now.AddDays(2), "2026-07-23T00:00:00Z", 0);

        var allowed = EventLifecyclePolicy.CanCreateEnrollment(groupEvent, now, out var error);

        Assert.False(allowed);
        Assert.Equal("This event is not accepting enrollments.", error);
    }

    [Fact]
    public void CanCreateEnrollment_RejectsEventWithoutApprovedRam()
    {
        var now = new DateTime(2026, 7, 22, 0, 0, 0, DateTimeKind.Utc);
        var groupEvent = EventEndingAt(now.AddDays(2), "2026-07-23T00:00:00Z", 20);
        groupEvent.RamAssessment!.Status = EventRamStatus.AwaitingReview;
        groupEvent.EventDataJson = $$"""{"registrationDeadline":"2026-07-23T00:00:00Z","maxCapacity":20,"hardConstraints":[{"ruleKey":"children"}]}""";

        var allowed = EventLifecyclePolicy.CanCreateEnrollment(groupEvent, now, out var error);

        Assert.False(allowed);
        Assert.Contains("RAM has not been approved", error);
    }

    [Fact]
    public void CanCreateEnrollment_DoesNotInventRamApprovalForLowRiskEvent()
    {
        var now = new DateTime(2026, 7, 22, 0, 0, 0, DateTimeKind.Utc);
        var groupEvent = EventEndingAt(now.AddDays(2), "2026-07-23T00:00:00Z", 20);
        groupEvent.RamAssessment!.Status = EventRamStatus.Draft;

        var allowed = EventLifecyclePolicy.CanCreateEnrollment(groupEvent, now, out var error);

        Assert.True(allowed);
        Assert.Empty(error);
    }

    private static GroupEvent EventEndingAt(DateTime endDate, string deadline, int capacity) => new()
    {
        StartDate = endDate.AddHours(-1),
        EndDate = endDate,
        EventDataJson = $$"""{"registrationDeadline":"{{deadline}}","maxCapacity":{{capacity}}}""",
        RamAssessment = new EventRamAssessment { Status = EventRamStatus.Approved }
    };
}
