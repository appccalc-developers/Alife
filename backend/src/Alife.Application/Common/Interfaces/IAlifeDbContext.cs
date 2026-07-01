using Alife.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Common.Interfaces;

public interface IAlifeDbContext
{
    DbSet<Group> Groups { get; }
    DbSet<Member> Members { get; }
    DbSet<GroupMembership> GroupMemberships { get; }
    DbSet<PlatformRole> PlatformRoles { get; }
    DbSet<MemberPlatformRole> MemberPlatformRoles { get; }
    DbSet<AuditLog> AuditLogs { get; }
    DbSet<Page> Pages { get; }
    DbSet<Section> Sections { get; }
    DbSet<Link> Links { get; }
    DbSet<FileStorageProvider> FileStorageProviders { get; }
    DbSet<FileAsset> FileAssets { get; }
    DbSet<Sermon> Sermons { get; }
    DbSet<GroupEvent> GroupEvents { get; }
    DbSet<EventEnrollment> EventEnrollments { get; }
    DbSet<EventReview> EventReviews { get; }
    DbSet<NotificationMessage> NotificationMessages { get; }
    DbSet<VisitContactRequest> VisitContactRequests { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
