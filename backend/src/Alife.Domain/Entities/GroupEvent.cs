namespace Alife.Domain.Entities;

public class GroupEvent
{
	public Guid Id { get; set; }
	public Guid GroupId { get; set; }
	public Guid CreatedByMemberId { get; set; }
	public Guid? EventSeriesId { get; set; }
	public DateOnly? SeriesOccurrenceDate { get; set; }

	public string TitleEn { get; set; } = string.Empty;
	public string TitleZh { get; set; } = string.Empty;

	public DateTime StartDate { get; set; }
	public DateTime EndDate { get; set; }

	/// <summary>Full serialised <c>EventDto</c> JSON for rich event data.</summary>
	public string EventDataJson { get; set; } = "{}";

	public DateTime CreatedUtc { get; set; }
	public DateTime UpdatedUtc { get; set; }
	public bool IsDeleted { get; set; }

	public Group Group { get; set; } = null!;
	public Member CreatedByMember { get; set; } = null!;
	public EventSeries? EventSeries { get; set; }
	public ICollection<EventContactProfile> ContactProfiles { get; set; } = [];
	public EventRamAssessment? RamAssessment { get; set; }
	public EventWorkflowRun? WorkflowRun { get; set; }
	public ICollection<EventArtifact> Artifacts { get; set; } = [];
	public ICollection<EventVenueBooking> VenueBookings { get; set; } = [];
	public ICollection<EventRosterShift> RosterShifts { get; set; } = [];
	public ICollection<EventProgrammeItem> ProgrammeItems { get; set; } = [];
	public ICollection<EventPreparationTask> PreparationTasks { get; set; } = [];
	public ICollection<EventAttendanceRecord> AttendanceRecords { get; set; } = [];
	public ICollection<EventFinanceEntry> FinanceEntries { get; set; } = [];
	public EventFinanceReconciliation? FinanceReconciliation { get; set; }
	public EventClosureReport? ClosureReport { get; set; }
	public EventPlan? Plan { get; set; }
}
