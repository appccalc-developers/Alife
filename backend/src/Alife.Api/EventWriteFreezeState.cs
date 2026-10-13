using System.Security.Cryptography;
using System.Text;
using Alife.Application.Events.Services;

namespace Alife.Api;

public sealed record EventResetRuntimeStatus(
    bool Ready,
    bool Frozen,
    string? Epoch,
    string? ResetEpoch,
    string? SchemaVersion,
    string? SchemaEpoch,
    string? DataEpoch,
    bool ScheduledJobsAcknowledged,
    int ActiveMutations,
    int RetryAfterSeconds,
    bool ConfigurationValid,
    string? TargetIdentityHash);

public enum EventScheduledJob
{
    RamSync,
    RegistrationExpiry
}

public sealed class EventWriteFreezeState(IConfiguration configuration, IHostEnvironment environment)
{
    private const int RamSyncAcknowledged = 1;
    private const int RegistrationExpiryAcknowledged = 2;
    private const int AllScheduledJobsAcknowledged = RamSyncAcknowledged | RegistrationExpiryAcknowledged;
    private int activeMutations;
    private int acknowledgedScheduledJobs;

    public EventResetRuntimeStatus GetStatus()
    {
        var runtime = configuration["EVENT_RUNTIME_ENVIRONMENT"]?.Trim().ToLowerInvariant();
        var mode = configuration["EVENT_WRITE_MODE"]?.Trim().ToLowerInvariant();
        var schemaEpoch = configuration["EVENT_SCHEMA_EPOCH"]?.Trim();
        var dataEpoch = configuration["EVENT_DATA_EPOCH"]?.Trim();
        var resetEpoch = configuration["EVENT_WRITE_FREEZE_EPOCH"]?.Trim();
        var production = environment.IsProduction() || runtime == "production";
        var modeValid = mode is "open" or "frozen";
        var configurationValid = !production ||
            runtime == "production" && modeValid && schemaEpoch == EventCompositionDefinitions.SchemaVersion &&
            IsIdentifier(dataEpoch) && (mode != "frozen" || IsIdentifier(resetEpoch) && dataEpoch == resetEpoch);
        var frozen = !configurationValid || mode == "frozen" || !string.IsNullOrWhiteSpace(resetEpoch);
        var retryAfter = int.TryParse(configuration["EVENT_WRITE_FREEZE_RETRY_AFTER_SECONDS"], out var configured) && configured > 0
            ? configured
            : 60;
        var active = Volatile.Read(ref activeMutations);
        var scheduledJobsAcknowledged = Volatile.Read(ref acknowledgedScheduledJobs) == AllScheduledJobsAcknowledged;
        var ready = configurationValid && mode == "frozen" &&
            schemaEpoch == EventCompositionDefinitions.SchemaVersion && !string.IsNullOrWhiteSpace(resetEpoch) &&
            dataEpoch == resetEpoch &&
            active == 0 && scheduledJobsAcknowledged;
        return new(ready, frozen, resetEpoch, resetEpoch, schemaEpoch, schemaEpoch, dataEpoch,
            scheduledJobsAcknowledged, active, retryAfter, configurationValid, TargetIdentityHash: null);
    }

    public EventMutationLease? TryEnterMutation()
    {
        if (GetStatus().Frozen) return null;

        Interlocked.Increment(ref activeMutations);
        if (!GetStatus().Frozen) return new EventMutationLease(this);

        ExitMutation();
        return null;
    }

    public void AcknowledgeScheduledJob(EventScheduledJob job)
    {
        var flag = job switch
        {
            EventScheduledJob.RamSync => RamSyncAcknowledged,
            EventScheduledJob.RegistrationExpiry => RegistrationExpiryAcknowledged,
            _ => throw new ArgumentOutOfRangeException(nameof(job), job, null)
        };
        Interlocked.Or(ref acknowledgedScheduledJobs, flag);
    }

    public bool IsMaintenanceIdentity(string? authorization)
    {
        var expected = configuration["EVENT_RESET_FREEZE_STATUS_TOKEN"] ??
            configuration["EVENT_RESET_STATUS_TOKEN"];
        var supplied = authorization?.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase) == true
            ? authorization[7..].Trim()
            : string.Empty;
        if (string.IsNullOrWhiteSpace(expected) || string.IsNullOrWhiteSpace(supplied)) return false;
        var left = SHA256.HashData(Encoding.UTF8.GetBytes(supplied));
        var right = SHA256.HashData(Encoding.UTF8.GetBytes(expected));
        return CryptographicOperations.FixedTimeEquals(left, right);
    }

    public static bool IsEventMutation(HttpRequest request)
    {
        if (request.Method is not ("POST" or "PUT" or "PATCH" or "DELETE")) return false;
        var path = request.Path.Value?.TrimEnd('/') ?? string.Empty;
        if (path.Equals("/api/events", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/api/events/", StringComparison.OrdinalIgnoreCase) ||
            path.Equals("/api/event-series", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/api/event-series/", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/api/enrollments/", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/api/reviews/", StringComparison.OrdinalIgnoreCase) ||
            path.Equals("/api/ai/event-poster", StringComparison.OrdinalIgnoreCase) ||
            path.Equals("/api/internal/ram/identify", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/api/event-", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/api/admin/event-", StringComparison.OrdinalIgnoreCase)) return true;
        var segments = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        return segments.Length >= 4 && segments[0].Equals("api", StringComparison.OrdinalIgnoreCase) &&
            segments[1].Equals("groups", StringComparison.OrdinalIgnoreCase) &&
            (segments[3].Equals("events", StringComparison.OrdinalIgnoreCase) ||
             segments[3].Equals("event-series", StringComparison.OrdinalIgnoreCase) ||
             segments[3].StartsWith("event-", StringComparison.OrdinalIgnoreCase) ||
             segments[3].Equals("venues", StringComparison.OrdinalIgnoreCase)) ||
            segments.Length >= 5 && segments[0].Equals("api", StringComparison.OrdinalIgnoreCase) &&
            segments[1].Equals("admin", StringComparison.OrdinalIgnoreCase) &&
            segments[2].Equals("churches", StringComparison.OrdinalIgnoreCase) &&
            segments[4].Equals("ram-policies", StringComparison.OrdinalIgnoreCase);
    }

    private void ExitMutation() => Interlocked.Decrement(ref activeMutations);

    private static bool IsIdentifier(string? value) =>
        !string.IsNullOrEmpty(value) && value.Length <= 128 &&
        value.All(character => char.IsAsciiLetterOrDigit(character) || character is '.' or '_' or '-');

    public sealed class EventMutationLease : IDisposable
    {
        private EventWriteFreezeState? owner;

        internal EventMutationLease(EventWriteFreezeState owner) => this.owner = owner;

        public void Dispose() => Interlocked.Exchange(ref owner, null)?.ExitMutation();
    }
}
