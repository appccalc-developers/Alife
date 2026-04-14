using Alife.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Common.Interfaces;

public interface IAlifeDbContext
{
    DbSet<Group> Groups { get; }
    DbSet<Member> Members { get; }
    DbSet<GroupMembership> GroupMemberships { get; }
    DbSet<Page> Pages { get; }
    DbSet<Section> Sections { get; }
    DbSet<Link> Links { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
