using Alife.Application.Common.Interfaces;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Infrastructure.Persistence;

public class AlifeDbContext(DbContextOptions<AlifeDbContext> options) : DbContext(options), IAlifeDbContext
{
	public DbSet<Group> Groups => Set<Group>();
	public DbSet<Member> Members => Set<Member>();
	public DbSet<GroupMembership> GroupMemberships => Set<GroupMembership>();
	public DbSet<Page> Pages => Set<Page>();
	public DbSet<Section> Sections => Set<Section>();
	public DbSet<Link> Links => Set<Link>();

	protected override void OnModelCreating(ModelBuilder modelBuilder)
	{
		const string phoneUniqueFilter = "[phone_e164] IS NOT NULL AND [is_registered] = 1";
		var approvedMembershipFilter = $"[status] = {(int)MembershipStatus.Approved}";
		var leaderMembershipFilter = $"[status] = {(int)MembershipStatus.Approved} AND [role] = {(int)MembershipRole.Leader}";

		modelBuilder.Entity<Group>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.Name).HasMaxLength(200).IsRequired();
			cfg.HasOne(x => x.ParentGroup)
				.WithMany(x => x.Subgroups)
				.HasForeignKey(x => x.ParentGroupId)
				.OnDelete(DeleteBehavior.Restrict);
		});

		modelBuilder.Entity<Member>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.DisplayName).HasMaxLength(150);
			cfg.Property(x => x.Email).HasMaxLength(200);
			cfg.Property(x => x.PhoneE164).HasMaxLength(30);
			cfg.HasIndex(x => x.PhoneE164)
				.IsUnique()
				.HasFilter(phoneUniqueFilter);
		});

		modelBuilder.Entity<GroupMembership>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.HasOne(x => x.Group).WithMany(x => x.Memberships).HasForeignKey(x => x.GroupId);
			cfg.HasOne(x => x.Member).WithMany(x => x.Memberships).HasForeignKey(x => x.MemberId);

			cfg.HasIndex(x => new { x.GroupId, x.MemberId })
				.IsUnique()
				.HasFilter(approvedMembershipFilter);

			cfg.HasIndex(x => new { x.GroupId, x.Role })
				.IsUnique()
				.HasFilter(leaderMembershipFilter);
		});

		modelBuilder.Entity<Page>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.Property(x => x.Title).HasMaxLength(200).IsRequired();
			cfg.Property(x => x.Slug).HasMaxLength(200).IsRequired();
			cfg.Property(x => x.Language).HasMaxLength(5).IsRequired();
			cfg.Property(x => x.TitleDisplayStyle).HasMaxLength(50).IsRequired();

			cfg.HasOne(x => x.OwnerGroup)
				.WithMany()
				.HasForeignKey(x => x.OwnerGroupId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasOne(x => x.CreatedByMember)
				.WithMany()
				.HasForeignKey(x => x.CreatedByMemberId)
				.OnDelete(DeleteBehavior.Restrict);

			cfg.HasIndex(x => new { x.Scope, x.OwnerGroupId, x.Slug, x.Language }).IsUnique();
		});

		modelBuilder.Entity<Section>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.HasOne(x => x.Page).WithMany(x => x.Sections).HasForeignKey(x => x.PageId);
		});

		modelBuilder.Entity<Link>(cfg =>
		{
			cfg.HasKey(x => x.Id);
			cfg.HasOne(x => x.OwnerSection).WithMany(x => x.Links).HasForeignKey(x => x.OwnerSectionId);
			cfg.Property(x => x.Title).HasMaxLength(200).IsRequired();
			cfg.Property(x => x.ImageUrl).HasMaxLength(500);
		});
	}
}
