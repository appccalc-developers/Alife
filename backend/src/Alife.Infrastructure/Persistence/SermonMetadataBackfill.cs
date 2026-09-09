using Alife.Application.Sermons.Services;
using Microsoft.EntityFrameworkCore;

namespace Alife.Infrastructure.Persistence;

public static class SermonMetadataBackfill
{
    public static async Task<int> RunAsync(AlifeDbContext db, ISermonCacheInvalidationService cache, CancellationToken token = default)
    {
        var sermons = await db.Sermons.IgnoreQueryFilters()
            .Where(sermon => sermon.MetadataVersion < SermonMetadata.CurrentVersion).ToListAsync(token);
        foreach (var sermon in sermons)
        {
            SermonMetadata.NormalizeExisting(sermon);
            sermon.UpdatedUtc = DateTime.UtcNow;
        }
        if (sermons.Count > 0)
        {
            await db.SaveChangesAsync(token);
            await cache.RemoveAllAsync(token);
        }
        return sermons.Count;
    }
}
