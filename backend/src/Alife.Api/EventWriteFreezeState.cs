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
    // The reset protocol epoch is independent of the still-supported 1.x Event composition.
    private const string ResetSchemaEpoch = "2.0.0";
    private const int RamSyncAcknowledged = 1;
    private const int RegistrationExpiryAcknowledged = 2;
    private const int AllScheduledJobsAcknowledged = RamSyncAcknowledged | RegistrationExpiryAcknowledged;
    private readonly object acknowledgementGate = new();
    private int activeMutations;
    private int acknowledgedScheduledJobs;
    private string? acknowledgedEpoch;

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
            runtime == "production" && modeValid && schemaEpoch == ResetSchemaEpoch &&
            IsIdentifier(dataEpoch) && (mode != "frozen" || IsIdentifier(resetEpoch) && dataEpoch == resetEpoch);
        var frozen = !configurationValid || mode == "frozen" || !string.IsNullOrWhiteSpace(resetEpoch);
        var retryAfter = int.TryParse(configuration["EVENT_WRITE_FREEZE_RETRY_AFTER_SECONDS"], out var configured) && configured > 0
            ? configured
            : 60;
        var active = Volatile.Read(ref activeMutations);
        var activeFrozenEpoch = configurationValid && mode == "frozen" &&
            schemaEpoch == ResetSchemaEpoch && IsIdentifier(resetEpoch) && dataEpoch == resetEpoch
            ? resetEpoch
            : null;
        bool scheduledJobsAcknowledged;
        lock (acknowledgementGate)
        {
            if (!string.Equals(acknowledgedEpoch, activeFrozenEpoch, StringComparison.Ordinal))
            {
                acknowledgedEpoch = activeFrozenEpoch;
                acknowledgedScheduledJobs = 0;
            }
            scheduledJobsAcknowledged = activeFrozenEpoch is not null &&
                acknowledgedScheduledJobs == AllScheduledJobsAcknowledged;
        }
        var ready = configurationValid && mode == "frozen" &&
            schemaEpoch == ResetSchemaEpoch && !string.IsNullOrWhiteSpace(resetEpoch) &&
            dataEpoch == resetEpoch &&
            active == 0 && scheduledJobsAcknowledged;
        return new(ready, frozen, resetEpoch, resetEpoch, EventCompositionDefinitions.SchemaVersion, schemaEpoch, dataEpoch,
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
        var status = GetStatus();
        if (!status.ConfigurationValid || status.ResetEpoch is null || !status.Frozen)
            return;
        lock (acknowledgementGate)
        {
            // Recheck mutable app settings so a timer cannot acknowledge a superseded epoch.
            var currentEpoch = configuration["EVENT_WRITE_FREEZE_EPOCH"]?.Trim();
            if (configuration["EVENT_WRITE_MODE"]?.Trim().ToLowerInvariant() != "frozen" ||
                configuration["EVENT_SCHEMA_EPOCH"]?.Trim() != ResetSchemaEpoch ||
                currentEpoch != status.ResetEpoch ||
                configuration["EVENT_DATA_EPOCH"]?.Trim() != currentEpoch)
                return;
            if (!string.Equals(acknowledgedEpoch, currentEpoch, StringComparison.Ordinal))
            {
                acknowledgedEpoch = currentEpoch;
                acknowledgedScheduledJobs = 0;
            }
            acknowledgedScheduledJobs |= flag;
        }
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
        if (path.Equals("/api/admin/file-assets/member-private/backfill", StringComparison.OrdinalIgnoreCase)) return true;
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
