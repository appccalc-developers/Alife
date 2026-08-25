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
    DbSet<Venue> Venues { get; }
    DbSet<VenueSpace> VenueSpaces { get; }
    DbSet<EventVenueBooking> EventVenueBookings { get; }
    DbSet<EventPlan> EventPlans { get; }
    DbSet<EventPlanRevision> EventPlanRevisions { get; }
    DbSet<EventOccurrence> EventOccurrences { get; }
    DbSet<EventModuleInstance> EventModuleInstances { get; }
    DbSet<EventReadinessGate> EventReadinessGates { get; }
    DbSet<EventDecisionRecord> EventDecisionRecords { get; }
    DbSet<GroupMemberSchedulingProfile> GroupMemberSchedulingProfiles { get; }
    DbSet<GroupRosterCapability> GroupRosterCapabilities { get; }
    DbSet<EventRosterShift> EventRosterShifts { get; }
    DbSet<EventRosterAssignment> EventRosterAssignments { get; }
    DbSet<EventProgrammeItem> EventProgrammeItems { get; }
    DbSet<EventClosureReport> EventClosureReports { get; }
    DbSet<EventPreparationTask> EventPreparationTasks { get; }
    DbSet<EventPreparationTaskDependency> EventPreparationTaskDependencies { get; }
    DbSet<EventAttendanceRecord> EventAttendanceRecords { get; }
    DbSet<EventFinanceEntry> EventFinanceEntries { get; }
    DbSet<EventFinanceReconciliation> EventFinanceReconciliations { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
