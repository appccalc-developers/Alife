using System.Data;
using Alife.Application.IdentityAccess;
using Alife.Domain.Entities;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Alife.Infrastructure.Security;

public sealed class SqlServerRateLimiter(
    AlifeDbContext dbContext,
    IIdentityTokenService tokenService) : IServerRateLimiter
{
    public async Task<RateLimitDecision> TryConsumeAsync(
        string scope,
        string rawKey,
        int limit,
        TimeSpan window,
        CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var windowTicks = window.Ticks;
        var started = new DateTime(now.Ticks - now.Ticks % windowTicks, DateTimeKind.Utc);
        var expires = started.Add(window);
        var keyHash = tokenService.HashLookup(rawKey);

        try
        {
            await using var transaction = dbContext.Database.IsRelational()
                ? await dbContext.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken)
                : null;

            var bucket = await dbContext.RateLimitBuckets
                .SingleOrDefaultAsync(
                    item => item.Scope == scope && item.KeyHash == keyHash && item.WindowStartedUtc == started,
                    cancellationToken);

            if (bucket is null)
            {
                bucket = new RateLimitBucket
                {
                    Id = Guid.NewGuid(),
                    Scope = scope,
                    KeyHash = keyHash,
                    WindowStartedUtc = started,
                    ExpiresUtc = expires,
                    Count = 1
                };
                dbContext.RateLimitBuckets.Add(bucket);
            }
            else if (bucket.Count < int.MaxValue)
            {
                bucket.Count++;
            }

            var allowed = bucket.Count <= limit;
            await dbContext.SaveChangesAsync(cancellationToken);

            if (transaction is not null)
            {
                await transaction.CommitAsync(cancellationToken);
            }

            return new RateLimitDecision(allowed, expires, Math.Max(0, limit - bucket.Count));
        }
        catch when (!cancellationToken.IsCancellationRequested)
        {
            return new RateLimitDecision(false, expires, 0);
        }
    }
}
