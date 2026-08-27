using Alife.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Common.Interfaces;

public interface IAlifeDbContext
{
    DbSet<Group> Groups { get; }
    DbSet<Member> Members { get; }
    DbSet<BibleReadingProgress> BibleReadingProgresses { get; }
    DbSet<GroupMembership> GroupMemberships { get; }
    DbSet<PlatformRole> PlatformRoles { get; }
    DbSet<MemberPlatformRole> MemberPlatformRoles { get; }
    DbSet<AuditLog> AuditLogs { get; }
    DbSet<Page> Pages { get; }
    DbSet<PagePrimaryMenu> PagePrimaryMenus { get; }
    DbSet<PagePublicationReview> PagePublicationReviews { get; }
    DbSet<Section> Sections { get; }
    DbSet<Link> Links { get; }
    DbSet<FileStorageProvider> FileStorageProviders { get; }
    DbSet<FileAsset> FileAssets { get; }
    DbSet<Album> Albums { get; }
    DbSet<AlbumPhoto> AlbumPhotos { get; }
    DbSet<Sermon> Sermons { get; }
    DbSet<GroupEvent> GroupEvents { get; }
    DbSet<EventSeries> EventSeries { get; }
    DbSet<EventOccurrence> EventOccurrences { get; }
    DbSet<EventSession> EventSessions { get; }
    DbSet<EventProgramItem> EventProgramItems { get; }
    DbSet<EventZone> EventZones { get; }
    DbSet<EventServiceSlot> EventServiceSlots { get; }
    DbSet<EventActivityTemplateVersion> EventActivityTemplateVersions { get; }
    DbSet<EventFactSet> EventFactSets { get; }
    DbSet<EventPlanSnapshot> EventPlanSnapshots { get; }
    DbSet<EventRoleAssignment> EventRoleAssignments { get; }
    DbSet<EventTeamMember> EventTeamMembers { get; }
    DbSet<EventTask> EventTasks { get; }
    DbSet<EventTaskDependency> EventTaskDependencies { get; }
    DbSet<EventTaskBlocker> EventTaskBlockers { get; }
    DbSet<EventRosterAvailability> EventRosterAvailability { get; }
    DbSet<EventRosterAssignment> EventRosterAssignments { get; }
    DbSet<EventVenue> EventVenues { get; }
    DbSet<EventVenueReservation> EventVenueReservations { get; }
    DbSet<EventTravelDriver> EventTravelDrivers { get; }
    DbSet<EventTravelVehicle> EventTravelVehicles { get; }
    DbSet<EventTravelJourney> EventTravelJourneys { get; }
    DbSet<EventTravelPickupStop> EventTravelPickupStops { get; }
    DbSet<EventTravelPassengerAssignment> EventTravelPassengerAssignments { get; }
    DbSet<EventSafeguardingPolicyVersion> EventSafeguardingPolicyVersions { get; }
    DbSet<EventSafeguardingConfiguration> EventSafeguardingConfigurations { get; }
    DbSet<EventChildRegistration> EventChildRegistrations { get; }
    DbSet<EventChildGuardianRelationship> EventChildGuardianRelationships { get; }
    DbSet<EventChildConsentRecord> EventChildConsentRecords { get; }
    DbSet<EventChildAuthorisedCollector> EventChildAuthorisedCollectors { get; }
    DbSet<EventChildAttendance> EventChildAttendanceRecords { get; }
    DbSet<EventSafeguardingWorkerEligibility> EventSafeguardingWorkerEligibility { get; }
    DbSet<EventApprovalDecision> EventApprovalDecisions { get; }
    DbSet<EventIdempotencyRecord> EventIdempotencyRecords { get; }
    DbSet<EventRamAssessment> EventRamAssessments { get; }
    DbSet<EventEnrollment> EventEnrollments { get; }
    DbSet<EventReview> EventReviews { get; }
    DbSet<EventWorkflowTemplate> EventWorkflowTemplates { get; }
    DbSet<EventWorkflowRun> EventWorkflowRuns { get; }
    DbSet<EventWorkflowStep> EventWorkflowSteps { get; }
    DbSet<EventArtifact> EventArtifacts { get; }
    DbSet<NotificationMessage> NotificationMessages { get; }
    DbSet<Announcement> Announcements { get; }
    DbSet<ContentPost> ContentPosts { get; }
    DbSet<VisitContactRequest> VisitContactRequests { get; }
    DbSet<ContactProfile> ContactProfiles { get; }
    DbSet<EventContactProfile> EventContactProfiles { get; }
    DbSet<ContactInquiry> ContactInquiries { get; }
    DbSet<ForumCategory> ForumCategories { get; }
    DbSet<ForumPost> ForumPosts { get; }
    DbSet<ForumComment> ForumComments { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
