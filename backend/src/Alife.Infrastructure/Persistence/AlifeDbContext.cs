using Alife.Application.Common.Interfaces;
using Alife.Domain.Entities;
using Alife.Application.Events.Services;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Infrastructure.Persistence;

public class AlifeDbContext(DbContextOptions<AlifeDbContext> options) : DbContext(options), IAlifeDbContext
{
	public DbSet<Group> Groups => Set<Group>();
	public DbSet<Member> Members => Set<Member>();
	public DbSet<BibleReadingProgress> BibleReadingProgresses => Set<BibleReadingProgress>();
	public DbSet<GroupMembership> GroupMemberships => Set<GroupMembership>();
	public DbSet<PlatformRole> PlatformRoles => Set<PlatformRole>();
	public DbSet<MemberPlatformRole> MemberPlatformRoles => Set<MemberPlatformRole>();
	public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
	public DbSet<Page> Pages => Set<Page>();
	public DbSet<PagePrimaryMenu> PagePrimaryMenus => Set<PagePrimaryMenu>();
	public DbSet<PagePublicationReview> PagePublicationReviews => Set<PagePublicationReview>();
	public DbSet<Section> Sections => Set<Section>();
	public DbSet<Link> Links => Set<Link>();
	public DbSet<FileStorageProvider> FileStorageProviders => Set<FileStorageProvider>();
	public DbSet<FileAsset> FileAssets => Set<FileAsset>();
	public DbSet<Album> Albums => Set<Album>();
	public DbSet<AlbumPhoto> AlbumPhotos => Set<AlbumPhoto>();
	public DbSet<Sermon> Sermons => Set<Sermon>();
	public DbSet<GroupEvent> GroupEvents => Set<GroupEvent>();
	public DbSet<EventSeries> EventSeries => Set<EventSeries>();
	public DbSet<EventOccurrence> EventOccurrences => Set<EventOccurrence>();
	public DbSet<EventSession> EventSessions => Set<EventSession>();
	public DbSet<EventProgramItem> EventProgramItems => Set<EventProgramItem>();
	public DbSet<EventZone> EventZones => Set<EventZone>();
	public DbSet<EventServiceSlot> EventServiceSlots => Set<EventServiceSlot>();
	public DbSet<EventActivityTemplateVersion> EventActivityTemplateVersions => Set<EventActivityTemplateVersion>();
	public DbSet<EventFactSet> EventFactSets => Set<EventFactSet>();
	public DbSet<EventPlanSnapshot> EventPlanSnapshots => Set<EventPlanSnapshot>();
	public DbSet<EventRoleAssignment> EventRoleAssignments => Set<EventRoleAssignment>();
	public DbSet<EventTeamMember> EventTeamMembers => Set<EventTeamMember>();
	public DbSet<EventTask> EventTasks => Set<EventTask>();
	public DbSet<EventTaskDependency> EventTaskDependencies => Set<EventTaskDependency>();
	public DbSet<EventTaskBlocker> EventTaskBlockers => Set<EventTaskBlocker>();
	public DbSet<EventRosterAvailability> EventRosterAvailability => Set<EventRosterAvailability>();
	public DbSet<EventRosterAssignment> EventRosterAssignments => Set<EventRosterAssignment>();
	public DbSet<EventVenue> EventVenues => Set<EventVenue>();
	public DbSet<EventVenueReservation> EventVenueReservations => Set<EventVenueReservation>();
	public DbSet<EventTravelDriver> EventTravelDrivers => Set<EventTravelDriver>();
	public DbSet<EventTravelVehicle> EventTravelVehicles => Set<EventTravelVehicle>();
	public DbSet<EventTravelJourney> EventTravelJourneys => Set<EventTravelJourney>();
	public DbSet<EventTravelPickupStop> EventTravelPickupStops => Set<EventTravelPickupStop>();
	public DbSet<EventTravelPassengerAssignment> EventTravelPassengerAssignments => Set<EventTravelPassengerAssignment>();
	public DbSet<EventSafeguardingPolicyVersion> EventSafeguardingPolicyVersions => Set<EventSafeguardingPolicyVersion>();
	public DbSet<EventSafeguardingConfiguration> EventSafeguardingConfigurations => Set<EventSafeguardingConfiguration>();
	public DbSet<EventChildRegistration> EventChildRegistrations => Set<EventChildRegistration>();
	public DbSet<EventChildGuardianRelationship> EventChildGuardianRelationships => Set<EventChildGuardianRelationship>();
	public DbSet<EventChildConsentRecord> EventChildConsentRecords => Set<EventChildConsentRecord>();
	public DbSet<EventChildAuthorisedCollector> EventChildAuthorisedCollectors => Set<EventChildAuthorisedCollector>();
	public DbSet<EventChildAttendance> EventChildAttendanceRecords => Set<EventChildAttendance>();
	public DbSet<EventSafeguardingWorkerEligibility> EventSafeguardingWorkerEligibility => Set<EventSafeguardingWorkerEligibility>();
	public DbSet<EventApprovalDecision> EventApprovalDecisions => Set<EventApprovalDecision>();
	public DbSet<EventIdempotencyRecord> EventIdempotencyRecords => Set<EventIdempotencyRecord>();
	public DbSet<EventRamAssessment> EventRamAssessments => Set<EventRamAssessment>();
	public DbSet<EventEnrollment> EventEnrollments => Set<EventEnrollment>();
	public DbSet<EventReview> EventReviews => Set<EventReview>();
	public DbSet<EventWorkflowTemplate> EventWorkflowTemplates => Set<EventWorkflowTemplate>();
	public DbSet<EventWorkflowRun> EventWorkflowRuns => Set<EventWorkflowRun>();
	public DbSet<EventWorkflowStep> EventWorkflowSteps => Set<EventWorkflowStep>();
	public DbSet<EventArtifact> EventArtifacts => Set<EventArtifact>();
	public DbSet<NotificationMessage> NotificationMessages => Set<NotificationMessage>();
	public DbSet<Announcement> Announcements => Set<Announcement>();
	public DbSet<ContentPost> ContentPosts => Set<ContentPost>();
	public DbSet<VisitContactRequest> VisitContactRequests => Set<VisitContactRequest>();
	public DbSet<ContactProfile> ContactProfiles => Set<ContactProfile>();
	public DbSet<EventContactProfile> EventContactProfiles => Set<EventContactProfile>();
	public DbSet<ContactInquiry> ContactInquiries => Set<ContactInquiry>();
	public DbSet<ForumCategory> ForumCategories => Set<ForumCategory>();
	public DbSet<ForumPost> ForumPosts => Set<ForumPost>();
	public DbSet<ForumComment> ForumComments => Set<ForumComment>();

	protected override void OnModelCreating(ModelBuilder modelBuilder)
	{
		const string phoneUniqueFilter = "[phone_e164] IS NOT NULL AND [is_registered] = 1";
		var approvedMembershipFilter = $"[status] = {(int)MembershipStatus.Approved}";
		var leaderMembershipFilter = $"[status] = {(int)MembershipStatus.Approved} AND [role] = {(int)MembershipRole.Leader}";

		modelBuilder.Entity<Group>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.NameJson).IsRequired();
			cfg.HasOne(x => x.ParentGroup)
				.WithMany(x => x.Subgroups)
				.HasForeignKey(x => x.ParentGroupId)
				.OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.ParentGroupId, x.UpdatedUtc });
		});

		modelBuilder.Entity<Member>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.DisplayName).HasMaxLength(150);
			cfg.Property(x => x.Salutation).HasMaxLength(100);
			cfg.Property(x => x.Email).HasMaxLength(200);
			cfg.Property(x => x.PhoneE164).HasMaxLength(30);
			cfg.Property(x => x.LineUID).HasMaxLength(100);
			cfg.HasIndex(x => x.UpdatedUtc);
			cfg.HasIndex(x => x.PhoneE164)
				.IsUnique()
				.HasFilter(phoneUniqueFilter);
			cfg.HasIndex(x => x.LineUID)
				.IsUnique()
				.HasFilter("[line_uid] IS NOT NULL AND [is_registered] = 1");
		});

		modelBuilder.Entity<BibleReadingProgress>(cfg =>
		{
			cfg.HasKey(x => x.MemberId);
			cfg.Property(x => x.Book).HasMaxLength(10).IsRequired();
			cfg.Property(x => x.Language).HasMaxLength(2).IsRequired();
			cfg.Property(x => x.ZhVersion).HasMaxLength(50);
			cfg.Property(x => x.EnVersion).HasMaxLength(50);
			cfg.HasOne(x => x.Member)
				.WithOne(x => x.BibleReadingProgress)
				.HasForeignKey<BibleReadingProgress>(x => x.MemberId)
				.OnDelete(DeleteBehavior.Cascade);
		});

		modelBuilder.Entity<GroupMembership>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.HasOne(x => x.Group).WithMany(x => x.Memberships).HasForeignKey(x => x.GroupId);
			cfg.HasOne(x => x.Member).WithMany(x => x.Memberships).HasForeignKey(x => x.MemberId);

			cfg.HasIndex(x => new { x.GroupId, x.MemberId })
				.IsUnique()
				.HasFilter(approvedMembershipFilter);
			cfg.HasIndex(x => new { x.MemberId, x.UpdatedUtc });
			cfg.HasIndex(x => new { x.GroupId, x.UpdatedUtc });

			cfg.HasIndex(x => new { x.GroupId, x.Role })
				.IsUnique()
				.HasFilter(leaderMembershipFilter);
		});

		modelBuilder.Entity<PlatformRole>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.Id).ValueGeneratedNever();
			cfg.Property(x => x.Code).HasMaxLength(50).IsRequired();
			cfg.Property(x => x.NameJson).IsRequired();
			cfg.Property(x => x.PermissionsJson).IsRequired();
			cfg.HasIndex(x => x.Code).IsUnique();
			cfg.HasIndex(x => x.Level);
		});

		modelBuilder.Entity<MemberPlatformRole>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.HasOne(x => x.Member)
				.WithMany(x => x.PlatformRoles)
				.HasForeignKey(x => x.MemberId)
				.OnDelete(DeleteBehavior.Cascade);
			cfg.HasOne(x => x.Role)
				.WithMany(x => x.MemberRoles)
				.HasForeignKey(x => x.RoleId)
				.OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.AssignedByMember)
				.WithMany(x => x.AssignedPlatformRoles)
				.HasForeignKey(x => x.AssignedByMemberId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasIndex(x => new { x.MemberId, x.RoleId })
				.IsUnique()
				.HasFilter("[revoked_utc] IS NULL");
			cfg.HasIndex(x => new { x.RoleId, x.RevokedUtc });
		});

		modelBuilder.Entity<AuditLog>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.Action).HasMaxLength(120).IsRequired();
			cfg.Property(x => x.EntityType).HasMaxLength(80).IsRequired();
			cfg.Property(x => x.IpAddress).HasMaxLength(64);
			cfg.Property(x => x.UserAgent).HasMaxLength(500);

			cfg.HasOne(x => x.ActorMember)
				.WithMany()
				.HasForeignKey(x => x.ActorMemberId)
				.OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.TargetMember)
				.WithMany()
				.HasForeignKey(x => x.TargetMemberId)
				.OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.Group)
				.WithMany()
				.HasForeignKey(x => x.GroupId)
				.OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.Event)
				.WithMany()
				.HasForeignKey(x => x.EventId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasIndex(x => new { x.ActorMemberId, x.OccurredUtc });
			cfg.HasIndex(x => new { x.GroupId, x.OccurredUtc });
			cfg.HasIndex(x => new { x.EventId, x.OccurredUtc });
			cfg.HasIndex(x => new { x.TargetMemberId, x.OccurredUtc });
			cfg.HasIndex(x => new { x.Action, x.OccurredUtc });
		});

		modelBuilder.Entity<Page>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.TitleJson).IsRequired();
			cfg.Property(x => x.TitleDisplayStyle).HasMaxLength(50).IsRequired();

			cfg.HasOne(x => x.OwnerGroup)
				.WithMany()
				.HasForeignKey(x => x.OwnerGroupId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.CreatedByMember)
				.WithMany()
				.HasForeignKey(x => x.CreatedByMemberId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasIndex(x => new { x.OwnerGroupId, x.UpdatedUtc });
			cfg.HasQueryFilter(x => !x.IsDeleted);
		});

		modelBuilder.Entity<PagePrimaryMenu>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.NameJson).HasColumnType("nvarchar(max)").IsRequired();
			cfg.HasIndex(x => x.SortOrder);
			cfg.HasIndex(x => x.HomePlacement)
				.IsUnique()
				.HasFilter("[home_placement] IS NOT NULL");
		});

		modelBuilder.Entity<PagePublicationReview>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.PrimaryMenuNameJson).HasColumnType("nvarchar(max)");
			cfg.Property(x => x.AccessNameJson).HasColumnType("nvarchar(max)");
			cfg.Property(x => x.CardImageUrl).HasMaxLength(1200);
			cfg.Property(x => x.CardTextJson).HasColumnType("nvarchar(max)");
			cfg.Property(x => x.ReturnReason).HasMaxLength(1000);

			cfg.HasOne(x => x.Page)
				.WithMany()
				.HasForeignKey(x => x.PageId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.PrimaryMenu)
				.WithMany(x => x.PublicationReviews)
				.HasForeignKey(x => x.PrimaryMenuId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.ReviewedByMember)
				.WithMany()
				.HasForeignKey(x => x.ReviewedByMemberId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasIndex(x => x.PageId).IsUnique();
			cfg.HasIndex(x => new { x.PrimaryMenuId, x.MenuSortOrder });
			cfg.HasIndex(x => new { x.Status, x.UpdatedUtc });
			cfg.HasIndex(x => new { x.ReviewedByMemberId, x.ReviewedUtc });
		});

		modelBuilder.Entity<Section>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.HasOne(x => x.Page).WithMany(x => x.Sections).HasForeignKey(x => x.PageId);
			cfg.HasQueryFilter(x => !x.IsDeleted);
		});

		modelBuilder.Entity<Link>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.HasOne(x => x.OwnerSection).WithMany(x => x.Links).HasForeignKey(x => x.OwnerSectionId);
			cfg.Property(x => x.Title).HasMaxLength(200).IsRequired();
			cfg.Property(x => x.ImageUrl).HasMaxLength(500);
		});

		modelBuilder.Entity<FileStorageProvider>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.Code).HasMaxLength(80).IsRequired();
			cfg.Property(x => x.DisplayNameJson).IsRequired();
			cfg.Property(x => x.BucketName).HasMaxLength(120).IsRequired();
			cfg.Property(x => x.Region).HasMaxLength(80);
			cfg.Property(x => x.Endpoint).HasMaxLength(500);
			cfg.Property(x => x.PublicBaseUrl).HasMaxLength(500);
			cfg.Property(x => x.PrivateBaseUrl).HasMaxLength(500);
			cfg.Property(x => x.UploadApiBaseUrl).HasMaxLength(500);
			cfg.Property(x => x.PublicPathPrefix).HasMaxLength(200).IsRequired();
			cfg.Property(x => x.PrivatePathPrefix).HasMaxLength(200).IsRequired();
			cfg.HasIndex(x => x.Code).IsUnique();
			cfg.HasIndex(x => new { x.IsActive, x.IsDefault });
		});

		modelBuilder.Entity<FileAsset>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.StorageProvider).HasMaxLength(80).IsRequired();
			cfg.Property(x => x.BucketName).HasMaxLength(120).IsRequired();
			cfg.Property(x => x.ObjectKey).HasMaxLength(1024).IsRequired();
			cfg.Property(x => x.PublicUrl).HasMaxLength(1200);
			cfg.Property(x => x.OriginalFileName).HasMaxLength(260).IsRequired();
			cfg.Property(x => x.StoredFileName).HasMaxLength(260).IsRequired();
			cfg.Property(x => x.ContentType).HasMaxLength(160).IsRequired();
			cfg.Property(x => x.ETag).HasMaxLength(200);
			cfg.Property(x => x.RelatedEntityType).HasMaxLength(80);

			cfg.HasOne(x => x.Group)
				.WithMany()
				.HasForeignKey(x => x.GroupId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.OwnerMember)
				.WithMany()
				.HasForeignKey(x => x.OwnerMemberId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.StorageProviderProfile)
				.WithMany()
				.HasForeignKey(x => x.StorageProviderId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasIndex(x => x.StorageProviderId);
			cfg.HasIndex(x => new { x.StorageProvider, x.BucketName, x.ObjectKey })
				.IsUnique()
				.HasFilter("[is_deleted] = 0");
			cfg.HasIndex(x => new { x.GroupId, x.Visibility, x.UploadedUtc });
			cfg.HasIndex(x => new { x.OwnerMemberId, x.UploadedUtc });
			cfg.HasIndex(x => new { x.RelatedEntityType, x.RelatedEntityId });
			cfg.HasQueryFilter(x => !x.IsDeleted);
		});

		modelBuilder.Entity<Album>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.NameJson).IsRequired();
			cfg.HasOne(x => x.Group).WithMany().HasForeignKey(x => x.GroupId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.ParentAlbum).WithMany(x => x.Children).HasForeignKey(x => x.ParentAlbumId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.GroupId, x.ParentAlbumId, x.SortOrder });
			cfg.HasQueryFilter(x => !x.IsDeleted);
		});

		modelBuilder.Entity<AlbumPhoto>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.HasOne(x => x.Album).WithMany(x => x.Photos).HasForeignKey(x => x.AlbumId).OnDelete(DeleteBehavior.Cascade);
			cfg.HasOne(x => x.FileAsset).WithMany().HasForeignKey(x => x.FileAssetId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.AlbumId, x.FileAssetId }).IsUnique();
			cfg.HasIndex(x => new { x.AlbumId, x.SortOrder });
		});

		modelBuilder.Entity<Sermon>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.YoutubeVideoId).HasMaxLength(50).IsRequired();
			cfg.Property(x => x.Title).HasMaxLength(400).IsRequired();
			cfg.Property(x => x.SpeakerName).HasMaxLength(200).IsRequired();
			cfg.Property(x => x.ThumbnailUrl).HasMaxLength(1000);
			cfg.Property(x => x.VideoUrl).HasMaxLength(1000);
			cfg.HasIndex(x => x.YoutubeVideoId).IsUnique();
			cfg.HasIndex(x => x.SortOrder);
			cfg.HasIndex(x => x.UpdatedUtc);
			cfg.HasQueryFilter(x => !x.IsDeleted);
		});

		modelBuilder.Entity<GroupEvent>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.TitleEn).HasMaxLength(300).IsRequired();
			// Keep the composition-series relationship isolated from the legacy
			// event_series_id column used by the earlier event-planning lineage.
			cfg.Property(x => x.EventSeriesId).HasColumnName("composition_series_id");
			cfg.Property(x => x.TitleZh).HasMaxLength(300).IsRequired();
			cfg.Property(x => x.GovernanceMode).HasDefaultValue(EventGovernanceMode.MemberLed);
			cfg.Property(x => x.PlanConcurrencyToken).HasDefaultValueSql("NEWSEQUENTIALID()").IsConcurrencyToken();

			cfg.HasOne(x => x.Group)
				.WithMany()
				.HasForeignKey(x => x.GroupId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.CreatedByMember)
				.WithMany()
				.HasForeignKey(x => x.CreatedByMemberId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.AccountableOwnerMember)
				.WithMany()
				.HasForeignKey(x => x.AccountableOwnerMemberId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.EventSeries)
				.WithMany(x => x.Events)
				.HasForeignKey(x => x.EventSeriesId)
				.OnDelete(DeleteBehavior.Restrict)
				.HasConstraintName("fk_group_events_event_composition_series_composition_series_id");

			cfg.HasOne(x => x.ParentEvent)
				.WithMany(x => x.ChildEvents)
				.HasForeignKey(x => x.ParentEventId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasIndex(x => new { x.GroupId, x.UpdatedUtc });
			cfg.HasIndex(x => x.CreatedByMemberId);
			cfg.HasIndex(x => x.AccountableOwnerMemberId);
			cfg.HasIndex(x => x.EventSeriesId)
				.HasDatabaseName("ix_group_events_composition_series_id");
			cfg.HasIndex(x => x.ParentEventId);
			cfg.HasQueryFilter(x => !x.IsDeleted);
		});

		modelBuilder.Entity<EventSeries>(cfg =>
		{
			cfg.ToTable("event_composition_series");
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.NameEn).HasMaxLength(300).IsRequired();
			cfg.Property(x => x.NameZh).HasMaxLength(300).IsRequired();
			cfg.Property(x => x.RecurrenceRule).HasMaxLength(500).IsRequired();
			cfg.Property(x => x.TimeZone).HasMaxLength(100).IsRequired();
			cfg.Property(x => x.ExceptionDatesJson).IsRequired();
			cfg.Property(x => x.DefaultFactsJson).IsRequired();
			cfg.Property(x => x.DefaultTeamJson).IsRequired();
			cfg.HasOne(x => x.OwningGroup).WithMany().HasForeignKey(x => x.OwningGroupId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.CreatedByMember).WithMany().HasForeignKey(x => x.CreatedByMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.OwningGroupId, x.UpdatedUtc });
			cfg.HasQueryFilter(x => !x.IsDeleted);
		});

		modelBuilder.Entity<EventOccurrence>(cfg =>
		{
			cfg.ToTable("event_composition_occurrences");
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.LocalDate).HasColumnType("date");
			cfg.Property(x => x.AttendanceJson).IsRequired();
			cfg.Property(x => x.ExceptionsJson).IsRequired();
			cfg.Property(x => x.IncidentsJson).IsRequired();
			cfg.Property(x => x.ProgrammeConcurrencyToken).IsConcurrencyToken();
			cfg.Property(x => x.RosterConcurrencyToken).IsConcurrencyToken();
			cfg.HasOne(x => x.Event).WithMany(x => x.Occurrences).HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.EventId, x.StartUtc }).IsUnique();
			cfg.HasIndex(x => new { x.Status, x.StartUtc });
		});

		modelBuilder.Entity<EventSession>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.TitleEn).HasMaxLength(300).IsRequired();
			cfg.Property(x => x.TitleZh).HasMaxLength(300).IsRequired();
			cfg.Property(x => x.PlaceJson).IsRequired();
			cfg.Property(x => x.LocalRequirementsJson).IsRequired();
			cfg.HasOne(x => x.Occurrence).WithMany(x => x.Sessions).HasForeignKey(x => x.OccurrenceId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.LeadMember).WithMany().HasForeignKey(x => x.LeadMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.OccurrenceId, x.StartUtc });
		});

		modelBuilder.Entity<EventProgramItem>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.ContentJson).IsRequired();
			cfg.Property(x => x.TitleEn).HasMaxLength(300).IsRequired();
			cfg.Property(x => x.TitleZh).HasMaxLength(300).IsRequired();
			cfg.Property(x => x.DescriptionEn).HasMaxLength(2000).IsRequired();
			cfg.Property(x => x.DescriptionZh).HasMaxLength(2000).IsRequired();
			cfg.HasOne(x => x.Session).WithMany(x => x.ProgramItems).HasForeignKey(x => x.SessionId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.OwnerMember).WithMany().HasForeignKey(x => x.OwnerMemberId).OnDelete(DeleteBehavior.Restrict);
			// Reordering several items is a single optimistic-concurrency operation. A
			// unique database index can observe EF's intermediate swap order and reject
			// an otherwise valid permutation; the application validates the complete
			// ordered item set before saving.
			cfg.HasIndex(x => new { x.SessionId, x.SortOrder });
		});

		modelBuilder.Entity<EventZone>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.TitleEn).HasMaxLength(300).IsRequired();
			cfg.Property(x => x.TitleZh).HasMaxLength(300).IsRequired();
			cfg.Property(x => x.OperatingState).HasMaxLength(50).IsRequired();
			cfg.HasOne(x => x.Occurrence).WithMany(x => x.Zones).HasForeignKey(x => x.OccurrenceId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.LeadMember).WithMany().HasForeignKey(x => x.LeadMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.OccurrenceId, x.TitleEn });
		});

		modelBuilder.Entity<EventServiceSlot>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.RoleCode).HasMaxLength(120).IsRequired();
			cfg.Property(x => x.EligibilityCode).HasMaxLength(120).IsRequired();
			cfg.HasOne(x => x.Occurrence).WithMany(x => x.ServiceSlots).HasForeignKey(x => x.OccurrenceId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.Session).WithMany(x => x.ServiceSlots).HasForeignKey(x => x.SessionId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.Zone).WithMany(x => x.ServiceSlots).HasForeignKey(x => x.ZoneId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.ProgramItem).WithMany().HasForeignKey(x => x.ProgramItemId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.OccurrenceId, x.StartUtc, x.RoleCode });
		});

		modelBuilder.Entity<EventActivityTemplateVersion>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.Code).HasMaxLength(80).IsRequired();
			cfg.Property(x => x.ArchetypeCode).HasMaxLength(80).IsRequired();
			cfg.Property(x => x.NameEn).HasMaxLength(200).IsRequired();
			cfg.Property(x => x.NameZh).HasMaxLength(200).IsRequired();
			cfg.Property(x => x.DescriptionEn).HasMaxLength(1000).IsRequired();
			cfg.Property(x => x.DescriptionZh).HasMaxLength(1000).IsRequired();
			cfg.Property(x => x.IconKey).HasMaxLength(80).IsRequired();
			cfg.Property(x => x.Visibility).HasMaxLength(40).IsRequired();
			cfg.Property(x => x.RegistrationMode).HasMaxLength(40).IsRequired();
			cfg.Property(x => x.PreselectedModulesJson).IsRequired();
			cfg.Property(x => x.RecommendedWorkflowTemplateCode).HasMaxLength(80);
			cfg.Property(x => x.PresetServiceSlotsJson).IsRequired();
			cfg.Property(x => x.ConcurrencyToken).IsConcurrencyToken();
			cfg.HasOne(x => x.CreatedByMember).WithMany().HasForeignKey(x => x.CreatedByMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.Code, x.Version }).IsUnique();
			cfg.HasIndex(x => x.Code).IsUnique().HasFilter("[is_current] = 1");
			cfg.HasIndex(x => new { x.ArchetypeCode, x.IsCurrent, x.IsActive, x.NameEn });
			cfg.HasData(EventActivityTemplateCatalog.CreateSystemSeedEntities());
		});

		modelBuilder.Entity<EventFactSet>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.SchemaVersion).HasMaxLength(20).IsRequired();
			cfg.Property(x => x.FactsJson).IsRequired();
			cfg.Property(x => x.SourceHash).HasMaxLength(64).IsRequired();
			cfg.HasOne(x => x.Event).WithMany(x => x.FactSets).HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.CreatedByMember).WithMany().HasForeignKey(x => x.CreatedByMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.EventId, x.Version }).IsUnique();
		});

		modelBuilder.Entity<EventPlanSnapshot>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.SchemaVersion).HasMaxLength(20).IsRequired();
			cfg.Property(x => x.ProposalHash).HasMaxLength(64).IsRequired();
			cfg.Property(x => x.ETag).HasMaxLength(120).IsRequired();
			cfg.Property(x => x.ArchetypeCode).HasMaxLength(80);
			cfg.Property(x => x.ActivityTypeCode).HasMaxLength(80);
			cfg.Property(x => x.SnapshotJson).IsRequired();
			cfg.HasOne(x => x.Event).WithMany(x => x.PlanSnapshots).HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.SourceFactSet).WithMany(x => x.PlanSnapshots).HasForeignKey(x => x.SourceFactSetId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.AcceptedByMember).WithMany().HasForeignKey(x => x.AcceptedByMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.EventId, x.Version }).IsUnique();
			cfg.HasIndex(x => x.EventId).IsUnique().HasFilter("[is_active] = 1");
		});

	modelBuilder.Entity<EventRoleAssignment>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.RoleRequirementKey).HasMaxLength(160).IsRequired();
			cfg.Property(x => x.ScopeType).HasMaxLength(50).IsRequired();
			cfg.Property(x => x.Status).IsConcurrencyToken();
			cfg.HasOne(x => x.Event).WithMany(x => x.RoleAssignments).HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.Member).WithMany().HasForeignKey(x => x.MemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.AssignedByMember).WithMany().HasForeignKey(x => x.AssignedByMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.EventId, x.RoleRequirementKey, x.MemberId }).IsUnique().HasFilter("[ended_utc] IS NULL");
			cfg.HasIndex(x => new { x.MemberId, x.EndedUtc });
		});

		modelBuilder.Entity<EventTeamMember>(cfg =>
		{
			cfg.ToTable("event_operations_team_members");
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.Status).IsConcurrencyToken();
			cfg.HasOne(x => x.Event).WithMany(x => x.TeamMembers).HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.Member).WithMany().HasForeignKey(x => x.MemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.InvitedByMember).WithMany().HasForeignKey(x => x.InvitedByMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.EventId, x.MemberId }).IsUnique().HasFilter("[ended_utc] IS NULL");
		});

		modelBuilder.Entity<EventTask>(cfg =>
		{
			cfg.ToTable("event_operations_tasks");
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.TitleEn).HasMaxLength(300).IsRequired();
			cfg.Property(x => x.TitleZh).HasMaxLength(300).IsRequired();
			cfg.Property(x => x.DescriptionEn).HasMaxLength(2000).IsRequired();
			cfg.Property(x => x.DescriptionZh).HasMaxLength(2000).IsRequired();
			cfg.Property(x => x.ConcurrencyToken).IsConcurrencyToken();
			cfg.HasOne(x => x.Event).WithMany(x => x.Tasks).HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.WorkflowStep).WithMany().HasForeignKey(x => x.WorkflowStepId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.AssignedMember).WithMany().HasForeignKey(x => x.AssignedMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.EventId, x.Status, x.DueUtc });
		});

		modelBuilder.Entity<EventTaskDependency>(cfg =>
		{
			cfg.ToTable("event_operations_task_dependencies");
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.DependencyType).HasMaxLength(50).IsRequired();
			cfg.HasOne(x => x.EventTask).WithMany(x => x.Dependencies).HasForeignKey(x => x.EventTaskId).OnDelete(DeleteBehavior.Cascade);
			cfg.HasOne(x => x.DependsOnEventTask).WithMany(x => x.Dependants).HasForeignKey(x => x.DependsOnEventTaskId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.EventTaskId, x.DependsOnEventTaskId }).IsUnique();
		});

		modelBuilder.Entity<EventTaskBlocker>(cfg =>
		{
			cfg.ToTable("event_operations_task_blockers");
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.Reason).HasMaxLength(1000).IsRequired();
			cfg.Property(x => x.Resolution).HasMaxLength(1000);
			cfg.HasOne(x => x.EventTask).WithMany(x => x.Blockers).HasForeignKey(x => x.EventTaskId).OnDelete(DeleteBehavior.Cascade);
			cfg.HasOne(x => x.CreatedByMember).WithMany().HasForeignKey(x => x.CreatedByMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.ResolvedByMember).WithMany().HasForeignKey(x => x.ResolvedByMemberId).OnDelete(DeleteBehavior.Restrict);
		});

		modelBuilder.Entity<EventRosterAvailability>(cfg =>
		{
			cfg.ToTable("event_operations_roster_availability");
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.Status).IsConcurrencyToken();
			cfg.HasOne(x => x.ServiceSlot).WithMany(x => x.Availability).HasForeignKey(x => x.ServiceSlotId).OnDelete(DeleteBehavior.Cascade);
			cfg.HasOne(x => x.Member).WithMany().HasForeignKey(x => x.MemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.ServiceSlotId, x.MemberId }).IsUnique();
		});

		modelBuilder.Entity<EventRosterAssignment>(cfg =>
		{
			cfg.ToTable("event_operations_roster_assignments");
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.Status).IsConcurrencyToken();
			cfg.HasOne(x => x.ServiceSlot).WithMany(x => x.Assignments).HasForeignKey(x => x.ServiceSlotId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.Member).WithMany().HasForeignKey(x => x.MemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.AssignedByMember).WithMany().HasForeignKey(x => x.AssignedByMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.ReplacesAssignment).WithMany().HasForeignKey(x => x.ReplacesAssignmentId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.ServiceSlotId, x.MemberId }).IsUnique().HasFilter("[ended_utc] IS NULL");
		});

		modelBuilder.Entity<EventVenue>(cfg =>
		{
			cfg.ToTable("event_resource_venues", table =>
				table.HasCheckConstraint("ck_event_resource_venues_capacity", "[capacity] > 0"));
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.NameEn).HasMaxLength(300).IsRequired();
			cfg.Property(x => x.NameZh).HasMaxLength(300).IsRequired();
			cfg.Property(x => x.AddressEn).HasMaxLength(1000).IsRequired();
			cfg.Property(x => x.AddressZh).HasMaxLength(1000).IsRequired();
			cfg.Property(x => x.ConcurrencyToken).IsConcurrencyToken();
			cfg.HasOne(x => x.ManagingGroup).WithMany().HasForeignKey(x => x.ManagingGroupId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.CreatedByMember).WithMany().HasForeignKey(x => x.CreatedByMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.ManagingGroupId, x.IsActive, x.NameEn });
		});

		modelBuilder.Entity<EventVenueReservation>(cfg =>
		{
			cfg.ToTable("event_resource_venue_reservations", table =>
			{
				table.HasCheckConstraint("ck_event_resource_venue_reservations_capacity", "[required_capacity] > 0");
				table.HasCheckConstraint("ck_event_resource_venue_reservations_interval", "[end_utc] > [start_utc]");
				table.HasCheckConstraint("ck_event_resource_venue_reservations_release", "([status] = 0 AND [released_utc] IS NULL AND [released_by_member_id] IS NULL) OR ([status] = 1 AND [released_utc] IS NOT NULL AND [released_by_member_id] IS NOT NULL)");
			});
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.ConcurrencyToken).IsConcurrencyToken();
			cfg.HasOne(x => x.Venue).WithMany(x => x.Reservations).HasForeignKey(x => x.VenueId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.Event).WithMany(x => x.VenueReservations).HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.EventOccurrence).WithMany(x => x.VenueReservations).HasForeignKey(x => x.EventOccurrenceId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.ReservedByMember).WithMany().HasForeignKey(x => x.ReservedByMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.ReleasedByMember).WithMany().HasForeignKey(x => x.ReleasedByMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.VenueId, x.Status, x.StartUtc, x.EndUtc });
			cfg.HasIndex(x => new { x.EventId, x.Status, x.StartUtc });
			cfg.HasIndex(x => new { x.EventOccurrenceId, x.Status });
		});

		modelBuilder.Entity<EventTravelDriver>(cfg =>
		{
			cfg.ToTable("event_travel_drivers");
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.LicenceClass).HasMaxLength(40).IsRequired();
			cfg.Property(x => x.EvidenceNotes).HasMaxLength(500).IsRequired();
			cfg.Property(x => x.ConcurrencyToken).IsConcurrencyToken();
			cfg.HasOne(x => x.Event).WithMany(x => x.TravelDrivers).HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.Member).WithMany().HasForeignKey(x => x.MemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.VerifiedByMember).WithMany().HasForeignKey(x => x.VerifiedByMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.EventId, x.MemberId }).IsUnique();
			cfg.HasIndex(x => new { x.EventId, x.IsActive });
		});

		modelBuilder.Entity<EventTravelVehicle>(cfg =>
		{
			cfg.ToTable("event_travel_vehicles", table =>
				table.HasCheckConstraint("ck_event_travel_vehicles_seat_capacity", "[seat_capacity] > 0"));
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.NameEn).HasMaxLength(180).IsRequired();
			cfg.Property(x => x.NameZh).HasMaxLength(180).IsRequired();
			cfg.Property(x => x.RegistrationReference).HasMaxLength(40).IsRequired();
			cfg.Property(x => x.EvidenceNotes).HasMaxLength(500).IsRequired();
			cfg.Property(x => x.ConcurrencyToken).IsConcurrencyToken();
			cfg.HasOne(x => x.Event).WithMany(x => x.TravelVehicles).HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.VerifiedByMember).WithMany().HasForeignKey(x => x.VerifiedByMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.EventId, x.RegistrationReference }).IsUnique();
			cfg.HasIndex(x => new { x.EventId, x.IsActive });
		});

		modelBuilder.Entity<EventTravelJourney>(cfg =>
		{
			cfg.ToTable("event_travel_journeys", table =>
				table.HasCheckConstraint("ck_event_travel_journeys_interval", "[end_utc] > [start_utc]"));
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.NameEn).HasMaxLength(180).IsRequired();
			cfg.Property(x => x.NameZh).HasMaxLength(180).IsRequired();
			cfg.Property(x => x.ConcurrencyToken).IsConcurrencyToken();
			cfg.HasOne(x => x.Event).WithMany(x => x.TravelJourneys).HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.EventOccurrence).WithMany(x => x.TravelJourneys).HasForeignKey(x => x.EventOccurrenceId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.Driver).WithMany(x => x.Journeys).HasForeignKey(x => x.DriverId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.Vehicle).WithMany(x => x.Journeys).HasForeignKey(x => x.VehicleId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.CreatedByMember).WithMany().HasForeignKey(x => x.CreatedByMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.EventOccurrenceId, x.Status, x.StartUtc });
			cfg.HasIndex(x => new { x.EventId, x.Status });
		});

		modelBuilder.Entity<EventTravelPickupStop>(cfg =>
		{
			cfg.ToTable("event_travel_pickup_stops");
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.NameEn).HasMaxLength(180).IsRequired();
			cfg.Property(x => x.NameZh).HasMaxLength(180).IsRequired();
			cfg.Property(x => x.AddressEn).HasMaxLength(300).IsRequired();
			cfg.Property(x => x.AddressZh).HasMaxLength(300).IsRequired();
			cfg.HasOne(x => x.Journey).WithMany(x => x.PickupStops).HasForeignKey(x => x.JourneyId).OnDelete(DeleteBehavior.Cascade);
			cfg.HasIndex(x => new { x.JourneyId, x.SortOrder }).IsUnique();
		});

		modelBuilder.Entity<EventTravelPassengerAssignment>(cfg =>
		{
			cfg.ToTable("event_travel_passenger_assignments");
			cfg.HasKey(x => x.Id);
			cfg.HasOne(x => x.Journey).WithMany(x => x.PassengerAssignments).HasForeignKey(x => x.JourneyId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.Member).WithMany().HasForeignKey(x => x.MemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.PickupStop).WithMany(x => x.PassengerAssignments).HasForeignKey(x => x.PickupStopId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.AssignedByMember).WithMany().HasForeignKey(x => x.AssignedByMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.EndedByMember).WithMany().HasForeignKey(x => x.EndedByMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.JourneyId, x.MemberId }).IsUnique().HasFilter("[ended_utc] IS NULL");
			cfg.HasIndex(x => new { x.MemberId, x.EndedUtc });
		});

		modelBuilder.Entity<EventSafeguardingPolicyVersion>(cfg =>
		{
			cfg.ToTable("event_safeguarding_policy_versions", table =>
				table.HasCheckConstraint("ck_event_safeguarding_policy_versions_version", "[version] > 0"));
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.PolicyCode).HasMaxLength(120).IsRequired();
			cfg.Property(x => x.NameEn).HasMaxLength(300).IsRequired();
			cfg.Property(x => x.NameZh).HasMaxLength(300).IsRequired();
			cfg.Property(x => x.RequirementsJson).IsRequired();
			cfg.HasOne(x => x.Group).WithMany().HasForeignKey(x => x.GroupId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.CreatedByMember).WithMany().HasForeignKey(x => x.CreatedByMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.GroupId, x.PolicyCode, x.Version }).IsUnique();
			cfg.HasIndex(x => new { x.GroupId, x.IsPublished, x.EffectiveFromUtc });
		});

		modelBuilder.Entity<EventSafeguardingConfiguration>(cfg =>
		{
			cfg.ToTable("event_safeguarding_configurations");
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.ConcurrencyToken).IsConcurrencyToken();
			cfg.HasOne(x => x.Event).WithOne(x => x.SafeguardingConfiguration).HasForeignKey<EventSafeguardingConfiguration>(x => x.EventId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.PolicyVersion).WithMany().HasForeignKey(x => x.PolicyVersionId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.ConfiguredByMember).WithMany().HasForeignKey(x => x.ConfiguredByMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => x.EventId).IsUnique();
		});

		modelBuilder.Entity<EventChildRegistration>(cfg =>
		{
			cfg.ToTable("event_safeguarding_child_registrations");
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.PhotoUrl).HasMaxLength(1200);
			cfg.Property(x => x.ConcurrencyToken).IsConcurrencyToken();
			cfg.HasOne(x => x.Event).WithMany(x => x.ChildRegistrations).HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.Enrollment).WithMany().HasForeignKey(x => x.EnrollmentId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.ChildMember).WithMany().HasForeignKey(x => x.ChildMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.CreatedByMember).WithMany().HasForeignKey(x => x.CreatedByMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.EndedByMember).WithMany().HasForeignKey(x => x.EndedByMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.EventId, x.EnrollmentId }).IsUnique();
			cfg.HasIndex(x => new { x.EventId, x.ChildMemberId }).IsUnique().HasFilter("[is_active] = 1");
		});

		modelBuilder.Entity<EventChildGuardianRelationship>(cfg =>
		{
			cfg.ToTable("event_safeguarding_guardian_relationships");
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.RelationshipLabel).HasMaxLength(120).IsRequired();
			cfg.Property(x => x.ConcurrencyToken).IsConcurrencyToken();
			cfg.HasOne(x => x.ChildRegistration).WithMany(x => x.Guardians).HasForeignKey(x => x.ChildRegistrationId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.GuardianMember).WithMany().HasForeignKey(x => x.GuardianMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.CreatedByMember).WithMany().HasForeignKey(x => x.CreatedByMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.ChildRegistrationId, x.GuardianMemberId }).IsUnique().HasFilter("[status] <> 2");
		});

		modelBuilder.Entity<EventChildConsentRecord>(cfg =>
		{
			cfg.ToTable("event_safeguarding_child_consents");
			cfg.HasKey(x => x.Id);
			cfg.HasOne(x => x.ChildRegistration).WithMany(x => x.ConsentRecords).HasForeignKey(x => x.ChildRegistrationId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.GuardianRelationship).WithMany(x => x.ConsentRecords).HasForeignKey(x => x.GuardianRelationshipId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.PolicyVersion).WithMany().HasForeignKey(x => x.PolicyVersionId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.RecordedByMember).WithMany().HasForeignKey(x => x.RecordedByMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.ChildRegistrationId, x.PolicyVersionId, x.RecordedUtc });
		});

		modelBuilder.Entity<EventChildAuthorisedCollector>(cfg =>
		{
			cfg.ToTable("event_safeguarding_authorised_collectors");
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.DisplayName).HasMaxLength(200).IsRequired();
			cfg.Property(x => x.RelationshipLabel).HasMaxLength(120).IsRequired();
			cfg.Property(x => x.ConcurrencyToken).IsConcurrencyToken();
			cfg.HasOne(x => x.ChildRegistration).WithMany(x => x.AuthorisedCollectors).HasForeignKey(x => x.ChildRegistrationId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.AuthorisedByGuardianRelationship).WithMany(x => x.AuthorisedCollectors).HasForeignKey(x => x.AuthorisedByGuardianRelationshipId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.RevokedByMember).WithMany().HasForeignKey(x => x.RevokedByMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.ChildRegistrationId, x.IsActive, x.DisplayName });
		});

		modelBuilder.Entity<EventChildAttendance>(cfg =>
		{
			cfg.ToTable("event_safeguarding_child_attendance", table =>
				table.HasCheckConstraint("ck_event_safeguarding_child_attendance_checkout", "([state] = 0 AND [checked_out_utc] IS NULL AND [checked_out_by_member_id] IS NULL AND [collector_id] IS NULL) OR ([state] = 1 AND [checked_out_utc] IS NOT NULL AND [checked_out_by_member_id] IS NOT NULL AND [collector_id] IS NOT NULL)"));
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.ConcurrencyToken).IsConcurrencyToken();
			cfg.HasOne(x => x.Event).WithMany(x => x.ChildAttendanceRecords).HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.EventOccurrence).WithMany(x => x.ChildAttendanceRecords).HasForeignKey(x => x.EventOccurrenceId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.ChildRegistration).WithMany(x => x.AttendanceRecords).HasForeignKey(x => x.ChildRegistrationId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.CheckedInByMember).WithMany().HasForeignKey(x => x.CheckedInByMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.CheckedOutByMember).WithMany().HasForeignKey(x => x.CheckedOutByMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.Collector).WithMany(x => x.CollectionRecords).HasForeignKey(x => x.CollectorId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.EventOccurrenceId, x.ChildRegistrationId }).IsUnique();
			cfg.HasIndex(x => new { x.EventOccurrenceId, x.State });
		});

		modelBuilder.Entity<EventSafeguardingWorkerEligibility>(cfg =>
		{
			cfg.ToTable("event_safeguarding_worker_eligibility");
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.RoleRequirementKey).HasMaxLength(180).IsRequired();
			cfg.Property(x => x.EligibilityEvidenceCode).HasMaxLength(120).IsRequired();
			cfg.Property(x => x.EvidenceReference).HasMaxLength(300).IsRequired();
			cfg.Property(x => x.ConcurrencyToken).IsConcurrencyToken();
			cfg.HasOne(x => x.Event).WithMany(x => x.SafeguardingWorkerEligibility).HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.PolicyVersion).WithMany().HasForeignKey(x => x.PolicyVersionId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.Member).WithMany().HasForeignKey(x => x.MemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.VerifiedByMember).WithMany().HasForeignKey(x => x.VerifiedByMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.EventId, x.PolicyVersionId, x.MemberId, x.RoleRequirementKey, x.EligibilityEvidenceCode }).IsUnique();
		});

		modelBuilder.Entity<EventApprovalDecision>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.SubjectType).HasMaxLength(80).IsRequired();
			cfg.Property(x => x.Reason).HasMaxLength(1000).IsRequired();
			cfg.HasOne(x => x.Event).WithMany(x => x.ApprovalDecisions).HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.ActorMember).WithMany().HasForeignKey(x => x.ActorMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.EventId, x.SubjectType, x.DecidedUtc });
		});

		modelBuilder.Entity<EventIdempotencyRecord>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.Operation).HasMaxLength(80).IsRequired();
			cfg.Property(x => x.Key).HasMaxLength(200).IsRequired();
			cfg.Property(x => x.RequestHash).HasMaxLength(64).IsRequired();
			cfg.HasIndex(x => new { x.Operation, x.ScopeId, x.Key }).IsUnique();
			cfg.HasIndex(x => x.ExpiresUtc);
		});

		modelBuilder.Entity<EventRamAssessment>(cfg =>
		{
			cfg.HasKey(x => x.EventId);
			cfg.Property(x => x.RamDataJson).IsRequired();

			cfg.HasOne(x => x.Event)
				.WithOne(x => x.RamAssessment)
				.HasForeignKey<EventRamAssessment>(x => x.EventId)
				.OnDelete(DeleteBehavior.Cascade);

			cfg.HasOne(x => x.SubmittedByMember)
				.WithMany()
				.HasForeignKey(x => x.SubmittedByMemberId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.ApprovedByMember)
				.WithMany()
				.HasForeignKey(x => x.ApprovedByMemberId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasIndex(x => new { x.Status, x.UpdatedUtc });
		});

		modelBuilder.Entity<EventEnrollment>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.EnrollmentJson).IsRequired();

			cfg.HasOne(x => x.Group)
				.WithMany()
				.HasForeignKey(x => x.GroupId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.Event)
				.WithMany()
				.HasForeignKey(x => x.EventId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.Member)
				.WithMany()
				.HasForeignKey(x => x.MemberId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasIndex(x => new { x.EventId, x.MemberId }).IsUnique();
			cfg.HasIndex(x => new { x.GroupId, x.UpdatedUtc });
		});

		modelBuilder.Entity<EventReview>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.ReviewJson).IsRequired();

			cfg.HasOne(x => x.Group)
				.WithMany()
				.HasForeignKey(x => x.GroupId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.Event)
				.WithMany()
				.HasForeignKey(x => x.EventId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.Member)
				.WithMany()
				.HasForeignKey(x => x.MemberId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasIndex(x => new { x.EventId, x.MemberId });
			cfg.HasIndex(x => new { x.GroupId, x.UpdatedUtc });
		});

		modelBuilder.Entity<EventWorkflowTemplate>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.Code).HasMaxLength(80).IsRequired();
			cfg.Property(x => x.NameEn).HasMaxLength(200).IsRequired();
			cfg.Property(x => x.NameZh).HasMaxLength(200).IsRequired();
			cfg.Property(x => x.DescriptionEn).HasMaxLength(1000).IsRequired();
			cfg.Property(x => x.DescriptionZh).HasMaxLength(1000).IsRequired();
			cfg.Property(x => x.DefinitionJson).IsRequired();
			cfg.HasOne(x => x.OwnerGroup).WithMany().HasForeignKey(x => x.OwnerGroupId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.CreatedByMember).WithMany().HasForeignKey(x => x.CreatedByMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.Code, x.Version }).IsUnique();
			cfg.HasIndex(x => new { x.IsActive, x.Code });
			cfg.HasIndex(x => new { x.OwnerGroupId, x.IsActive, x.UpdatedUtc });
		});

		modelBuilder.Entity<EventWorkflowRun>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.TemplateSnapshotJson).IsRequired();
			cfg.Property(x => x.CurrentStepKey).HasMaxLength(100);
			cfg.HasOne(x => x.Event).WithOne(x => x.WorkflowRun).HasForeignKey<EventWorkflowRun>(x => x.EventId).OnDelete(DeleteBehavior.Cascade);
			cfg.HasOne(x => x.Template).WithMany(x => x.Runs).HasForeignKey(x => x.TemplateId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => x.EventId).IsUnique();
			cfg.HasIndex(x => new { x.Status, x.UpdatedUtc });
		});

		modelBuilder.Entity<EventWorkflowStep>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.StepKey).HasMaxLength(100).IsRequired();
			cfg.Property(x => x.NameEn).HasMaxLength(200).IsRequired();
			cfg.Property(x => x.NameZh).HasMaxLength(200).IsRequired();
			cfg.Property(x => x.IntegrationKey).HasMaxLength(80);
			cfg.HasOne(x => x.WorkflowRun).WithMany(x => x.Steps).HasForeignKey(x => x.WorkflowRunId).OnDelete(DeleteBehavior.Cascade);
			cfg.HasOne(x => x.AssignedMember).WithMany().HasForeignKey(x => x.AssignedMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.CompletedByMember).WithMany().HasForeignKey(x => x.CompletedByMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.WorkflowRunId, x.StepKey }).IsUnique();
			cfg.HasIndex(x => new { x.WorkflowRunId, x.SortOrder });
		});

		modelBuilder.Entity<EventArtifact>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.ArtifactType).HasMaxLength(100).IsRequired();
			cfg.Property(x => x.TitleEn).HasMaxLength(300).IsRequired();
			cfg.Property(x => x.TitleZh).HasMaxLength(300).IsRequired();
			cfg.Property(x => x.DataJson).IsRequired();
			cfg.HasOne(x => x.Event).WithMany(x => x.Artifacts).HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Cascade);
			cfg.HasOne(x => x.WorkflowStep).WithMany(x => x.Artifacts).HasForeignKey(x => x.WorkflowStepId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.FileAsset).WithMany().HasForeignKey(x => x.FileAssetId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.CreatedByMember).WithMany().HasForeignKey(x => x.CreatedByMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.ApprovedByMember).WithMany().HasForeignKey(x => x.ApprovedByMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.EventId, x.UpdatedUtc });
			cfg.HasIndex(x => x.WorkflowStepId);
			cfg.HasIndex(x => x.FileAssetId);
		});

		modelBuilder.Entity<NotificationMessage>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.ActionType).HasMaxLength(100).IsRequired();
			cfg.Property(x => x.ActionDataJson).IsRequired();

			cfg.HasOne(x => x.RecipientMember)
				.WithMany()
				.HasForeignKey(x => x.RecipientMemberId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.CreatedByMember)
				.WithMany()
				.HasForeignKey(x => x.CreatedByMemberId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.Group)
				.WithMany()
				.HasForeignKey(x => x.GroupId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.Event)
				.WithMany()
				.HasForeignKey(x => x.EventId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.Announcement)
				.WithMany(x => x.Notifications)
				.HasForeignKey(x => x.AnnouncementId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasIndex(x => new { x.RecipientMemberId, x.RepliedUtc, x.OccurredUtc });
			cfg.HasIndex(x => new { x.GroupId, x.UpdatedUtc });
			cfg.HasIndex(x => x.EventId);
			cfg.HasIndex(x => x.AnnouncementId);
			cfg.HasIndex(x => x.CreatedByMemberId);
		});

		modelBuilder.Entity<Announcement>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.TitleJson).IsRequired();
			cfg.Property(x => x.SummaryJson).IsRequired();
			cfg.Property(x => x.ContentJson).HasColumnType("nvarchar(max)");

			cfg.HasOne(x => x.Group)
				.WithMany()
				.HasForeignKey(x => x.GroupId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.CreatedByMember)
				.WithMany()
				.HasForeignKey(x => x.CreatedByMemberId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasIndex(x => new { x.GroupId, x.Status, x.PublishUtc, x.ExpireUtc });
			cfg.HasIndex(x => new { x.IsPinned, x.Priority, x.PublishUtc });
			cfg.HasIndex(x => x.CreatedByMemberId);
		});

		modelBuilder.Entity<ContentPost>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.TitleJson).HasColumnType("nvarchar(max)").IsRequired();
			cfg.Property(x => x.SummaryJson).HasColumnType("nvarchar(max)").IsRequired();
			cfg.Property(x => x.BodyJson).HasColumnType("nvarchar(max)").IsRequired();
			cfg.Property(x => x.Slug).HasMaxLength(180).IsRequired();
			cfg.Property(x => x.CoverImageUrl).HasMaxLength(1200);
			cfg.Property(x => x.Byline).HasMaxLength(200);
			cfg.Property(x => x.SourceUrl).HasMaxLength(1200);
			cfg.Property(x => x.SourceKey).HasMaxLength(64).IsFixedLength();
			cfg.Property(x => x.SourceChecksum).HasMaxLength(64).IsFixedLength();

			cfg.HasOne(x => x.OwnerGroup)
				.WithMany()
				.HasForeignKey(x => x.OwnerGroupId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.CreatedByMember)
				.WithMany()
				.HasForeignKey(x => x.CreatedByMemberId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasIndex(x => new { x.OwnerGroupId, x.Slug })
				.IsUnique()
				.HasFilter("[is_deleted] = 0");
			cfg.HasIndex(x => new { x.OwnerGroupId, x.Status, x.Visibility, x.PublishedUtc });
			cfg.HasIndex(x => new { x.OwnerGroupId, x.SourceKey })
				.IsUnique()
				.HasFilter("[source_key] IS NOT NULL");
			cfg.HasIndex(x => x.CreatedByMemberId);
			cfg.HasQueryFilter(x => !x.IsDeleted);
		});

		modelBuilder.Entity<VisitContactRequest>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.DisplayName).HasMaxLength(150).IsRequired();
			cfg.Property(x => x.Salutation).HasMaxLength(100);
			cfg.Property(x => x.Email).HasMaxLength(200);
			cfg.Property(x => x.Phone).HasMaxLength(60);
			cfg.Property(x => x.PreferredLanguage).HasMaxLength(20);
			cfg.Property(x => x.Message).HasMaxLength(2000);
			cfg.Property(x => x.SourcePage).HasMaxLength(500);
			cfg.Property(x => x.Status).HasMaxLength(40).IsRequired();
			cfg.Property(x => x.IpAddress).HasMaxLength(64);
			cfg.Property(x => x.UserAgent).HasMaxLength(500);

			cfg.HasOne(x => x.HandledByMember)
				.WithMany()
				.HasForeignKey(x => x.HandledByMemberId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasIndex(x => new { x.Status, x.SubmittedUtc });
			cfg.HasIndex(x => x.HandledByMemberId);
			cfg.HasIndex(x => x.SubmittedUtc);
		});

		modelBuilder.Entity<ContactProfile>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.NameJson).IsRequired();
			cfg.Property(x => x.RoleJson).IsRequired();
			cfg.Property(x => x.PhotoUrl).HasMaxLength(1200);
			cfg.Property(x => x.Phone).HasMaxLength(60);
			cfg.Property(x => x.Email).HasMaxLength(200);
			cfg.HasOne(x => x.Member).WithMany(x => x.ContactProfiles).HasForeignKey(x => x.MemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.OwnerGroup).WithMany(x => x.ContactProfiles).HasForeignKey(x => x.OwnerGroupId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.OwnerGroupId, x.MemberId }).IsUnique().HasFilter("[is_deleted] = 0");
			cfg.HasIndex(x => new { x.OwnerGroupId, x.Visibility, x.UpdatedUtc });
			cfg.HasQueryFilter(x => !x.IsDeleted);
		});

		modelBuilder.Entity<EventContactProfile>(cfg =>
		{
			cfg.HasKey(x => new { x.EventId, x.ContactProfileId });
			cfg.HasOne(x => x.Event).WithMany(x => x.ContactProfiles).HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Cascade);
			cfg.HasOne(x => x.ContactProfile).WithMany(x => x.Events).HasForeignKey(x => x.ContactProfileId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => x.ContactProfileId);
		});

		modelBuilder.Entity<ContactInquiry>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.DisplayName).HasMaxLength(150).IsRequired();
			cfg.Property(x => x.Email).HasMaxLength(200);
			cfg.Property(x => x.Phone).HasMaxLength(60);
			cfg.Property(x => x.Message).HasMaxLength(2000).IsRequired();
			cfg.Property(x => x.PreferredLanguage).HasMaxLength(20);
			cfg.Property(x => x.SourcePage).HasMaxLength(500);
			cfg.Property(x => x.IpAddress).HasMaxLength(64);
			cfg.Property(x => x.UserAgent).HasMaxLength(500);
			cfg.HasOne(x => x.ContactProfile).WithMany(x => x.Inquiries).HasForeignKey(x => x.ContactProfileId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.OwnerGroup).WithMany().HasForeignKey(x => x.OwnerGroupId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasOne(x => x.SubmittedByMember).WithMany().HasForeignKey(x => x.SubmittedByMemberId).OnDelete(DeleteBehavior.Restrict);
			cfg.HasIndex(x => new { x.ContactProfileId, x.SubmittedUtc });
			cfg.HasIndex(x => new { x.OwnerGroupId, x.SubmittedUtc });
		});

		modelBuilder.Entity<ForumCategory>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.NameJson).IsRequired();
			cfg.HasIndex(x => new { x.IsEnabled, x.SortOrder });
		});

		modelBuilder.Entity<ForumPost>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.TitleJson).IsRequired();
			cfg.Property(x => x.BodyJson).IsRequired();
			cfg.Property(x => x.MediaJson).IsRequired();

			cfg.HasOne(x => x.Category)
				.WithMany(x => x.Posts)
				.HasForeignKey(x => x.CategoryId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.Group)
				.WithMany()
				.HasForeignKey(x => x.GroupId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.Sermon)
				.WithOne(x => x.ForumPost)
				.HasForeignKey<ForumPost>(x => x.SermonId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.AuthorMember)
				.WithMany(x => x.ForumPosts)
				.HasForeignKey(x => x.AuthorMemberId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.LastCommentMember)
				.WithMany()
				.HasForeignKey(x => x.LastCommentMemberId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasIndex(x => new { x.Visibility, x.IsHidden, x.IsPinned, x.UpdatedUtc });
			cfg.HasIndex(x => new { x.CategoryId, x.Visibility, x.UpdatedUtc });
			cfg.HasIndex(x => new { x.GroupId, x.UpdatedUtc });
			cfg.HasIndex(x => x.AuthorMemberId);
			cfg.HasIndex(x => x.SermonId)
				.IsUnique()
				.HasFilter("[sermon_id] IS NOT NULL AND [deleted_utc] IS NULL");
			cfg.HasQueryFilter(x => x.DeletedUtc == null);
		});

		modelBuilder.Entity<ForumComment>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.BodyJson).IsRequired();
			cfg.Property(x => x.MediaJson).IsRequired();

			cfg.HasOne(x => x.Post)
				.WithMany(x => x.Comments)
				.HasForeignKey(x => x.PostId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.AuthorMember)
				.WithMany(x => x.ForumComments)
				.HasForeignKey(x => x.AuthorMemberId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.ParentComment)
				.WithMany(x => x.Replies)
				.HasForeignKey(x => x.ParentCommentId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasIndex(x => new { x.PostId, x.CreatedUtc });
			cfg.HasIndex(x => new { x.PostId, x.ParentCommentId, x.CreatedUtc });
			cfg.HasIndex(x => new { x.PostId, x.Visibility, x.IsHidden, x.CreatedUtc });
			cfg.HasIndex(x => x.AuthorMemberId);
			cfg.HasQueryFilter(x => x.DeletedUtc == null);
		});
	}
}
