using System.Text.Json;
using Alife.Api.HealthChecks;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Alife.Api;

internal static class ApiHealthCheckSetup
{
    public static void ConfigureServices(IServiceCollection services)
    {
        services
            .AddHealthChecks()
            .AddCheck("self", () => HealthCheckResult.Healthy(), tags: ["live"])
            .AddCheck<DatabaseTouchHealthCheck>("database-touch", tags: ["ready", "db"]);
    }

    public static void MapEndpoints(WebApplication app)
    {
        app.MapHealthChecks("/health/live", new HealthCheckOptions
        {
            Predicate = check => check.Tags.Contains("live")
        });

        app.MapHealthChecks("/health/ready", new HealthCheckOptions
        {
            Predicate = check => check.Tags.Contains("ready"),
            ResponseWriter = WriteHealthResponseAsync
        });

        // Backward compatible endpoint used by existing deployment probes.
        app.MapHealthChecks("/health", new HealthCheckOptions
        {
            Predicate = check => check.Tags.Contains("ready"),
            ResponseWriter = WriteHealthResponseAsync
        });
    }

    private static async Task WriteHealthResponseAsync(HttpContext context, HealthReport report)
    {
        context.Response.ContentType = "application/json";

        var payload = new
        {
            status = report.Status.ToString(),
            totalDurationMs = report.TotalDuration.TotalMilliseconds,
            checks = report.Entries.ToDictionary(
                kvp => kvp.Key,
                kvp => new
                {
                    status = kvp.Value.Status.ToString(),
                    durationMs = kvp.Value.Duration.TotalMilliseconds,
                    description = kvp.Value.Description,
                    error = kvp.Value.Exception?.Message,
                    data = kvp.Value.Data
                }),
            utc = DateTime.UtcNow
        };

        await context.Response.WriteAsync(JsonSerializer.Serialize(payload));
    }
}
