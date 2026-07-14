using Alife.Application.Common.Interfaces;
using Alife.Domain.Entities;
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
	public DbSet<PagePublicationReview> PagePublicationReviews => Set<PagePublicationReview>();
	public DbSet<Section> Sections => Set<Section>();
	public DbSet<Link> Links => Set<Link>();
	public DbSet<FileStorageProvider> FileStorageProviders => Set<FileStorageProvider>();
	public DbSet<FileAsset> FileAssets => Set<FileAsset>();
	public DbSet<Sermon> Sermons => Set<Sermon>();
	public DbSet<GroupEvent> GroupEvents => Set<GroupEvent>();
	public DbSet<EventEnrollment> EventEnrollments => Set<EventEnrollment>();
	public DbSet<EventReview> EventReviews => Set<EventReview>();
	public DbSet<NotificationMessage> NotificationMessages => Set<NotificationMessage>();
	public DbSet<Announcement> Announcements => Set<Announcement>();
	public DbSet<VisitContactRequest> VisitContactRequests => Set<VisitContactRequest>();
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

		modelBuilder.Entity<PagePublicationReview>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.AccessNameJson).HasColumnType("nvarchar(max)");
			cfg.Property(x => x.CardImageUrl).HasMaxLength(1200);
			cfg.Property(x => x.CardTextJson).HasColumnType("nvarchar(max)");
			cfg.Property(x => x.ReturnReason).HasMaxLength(1000);

			cfg.HasOne(x => x.Page)
				.WithMany()
				.HasForeignKey(x => x.PageId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.ReviewedByMember)
				.WithMany()
				.HasForeignKey(x => x.ReviewedByMemberId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasIndex(x => x.PageId).IsUnique();
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
			cfg.Property(x => x.TitleZh).HasMaxLength(300).IsRequired();

			cfg.HasOne(x => x.Group)
				.WithMany()
				.HasForeignKey(x => x.GroupId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.CreatedByMember)
				.WithMany()
				.HasForeignKey(x => x.CreatedByMemberId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasIndex(x => new { x.GroupId, x.UpdatedUtc });
			cfg.HasIndex(x => x.CreatedByMemberId);
			cfg.HasQueryFilter(x => !x.IsDeleted);
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

		modelBuilder.Entity<VisitContactRequest>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.DisplayName).HasMaxLength(150).IsRequired();
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
			cfg.HasIndex(x => x.AuthorMemberId);
			cfg.HasQueryFilter(x => x.DeletedUtc == null);
		});
	}
}
