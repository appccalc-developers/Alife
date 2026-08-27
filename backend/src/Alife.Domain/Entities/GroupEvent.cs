using Alife.Domain.Enums;

namespace Alife.Domain.Entities;

public class GroupEvent
{
	public Guid Id { get; set; }
	public Guid GroupId { get; set; }
	public Guid CreatedByMemberId { get; set; }
	public Guid AccountableOwnerMemberId { get; set; }
	public Guid? EventSeriesId { get; set; }
	public Guid? ParentEventId { get; set; }
	public EventGovernanceMode GovernanceMode { get; set; } = EventGovernanceMode.MemberLed;
	public EventSponsorshipStatus SponsorshipStatus { get; set; } = EventSponsorshipStatus.NotRequested;
	public int? ActivePlanVersion { get; set; }
	public Guid PlanConcurrencyToken { get; set; } = Guid.NewGuid();

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
	public Member AccountableOwnerMember { get; set; } = null!;
	public EventSeries? EventSeries { get; set; }
	public GroupEvent? ParentEvent { get; set; }
	public ICollection<GroupEvent> ChildEvents { get; set; } = [];
	public ICollection<EventContactProfile> ContactProfiles { get; set; } = [];
	public EventRamAssessment? RamAssessment { get; set; }
	public EventWorkflowRun? WorkflowRun { get; set; }
	public ICollection<EventArtifact> Artifacts { get; set; } = [];
	public ICollection<EventOccurrence> Occurrences { get; set; } = [];
	public ICollection<EventFactSet> FactSets { get; set; } = [];
	public ICollection<EventPlanSnapshot> PlanSnapshots { get; set; } = [];
	public ICollection<EventRoleAssignment> RoleAssignments { get; set; } = [];
	public ICollection<EventTeamMember> TeamMembers { get; set; } = [];
	public ICollection<EventTask> Tasks { get; set; } = [];
	public ICollection<EventApprovalDecision> ApprovalDecisions { get; set; } = [];
	public ICollection<EventVenueReservation> VenueReservations { get; set; } = [];
	public ICollection<EventTravelDriver> TravelDrivers { get; set; } = [];
	public ICollection<EventTravelVehicle> TravelVehicles { get; set; } = [];
	public ICollection<EventTravelJourney> TravelJourneys { get; set; } = [];
	public EventSafeguardingConfiguration? SafeguardingConfiguration { get; set; }
	public ICollection<EventChildRegistration> ChildRegistrations { get; set; } = [];
	public ICollection<EventChildAttendance> ChildAttendanceRecords { get; set; } = [];
	public ICollection<EventSafeguardingWorkerEligibility> SafeguardingWorkerEligibility { get; set; } = [];
}
