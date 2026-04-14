using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Alife.Api.HealthChecks;

public sealed class DatabaseTouchHealthCheck(AlifeDbContext dbContext, ILogger<DatabaseTouchHealthCheck> logger) : IHealthCheck
{
	public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
	{
		try
		{
			var canConnect = await dbContext.Database.CanConnectAsync(cancellationToken);
			if (!canConnect)
			{
				return HealthCheckResult.Unhealthy("Database connection check failed.");
			}

			await dbContext.Database.ExecuteSqlRawAsync("SELECT 1", cancellationToken);
			return HealthCheckResult.Healthy("Database touch succeeded.");
		}
		catch (Exception ex)
		{
			logger.LogError(ex, "Database touch health check failed.");
			return HealthCheckResult.Unhealthy("Database touch failed.", ex);
		}
	}
}