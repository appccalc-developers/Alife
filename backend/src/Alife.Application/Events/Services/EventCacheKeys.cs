namespace Alife.Application.Events.Services;

public static class EventCacheKeys
{
    public const string DevelopmentDataEpoch = "local-event-data";

    private static string Epoch(string? dataEpoch, bool requireConfigured)
    {
        if (requireConfigured && string.IsNullOrWhiteSpace(dataEpoch))
            throw new InvalidOperationException("EVENT_DATA_EPOCH is required for the production Event runtime.");
        var normalized = string.IsNullOrWhiteSpace(dataEpoch) ? DevelopmentDataEpoch : dataEpoch.Trim();
        if (normalized.Length > 128 || normalized.Any(character =>
                !char.IsAsciiLetterOrDigit(character) && character is not ('.' or '_' or '-')))
            throw new InvalidOperationException("EVENT_DATA_EPOCH must be a 1-128 character identifier.");
        return $"event:{EventCompositionDefinitions.SchemaVersion}:data:{normalized}";
    }

    public static string GroupEvents(Guid groupId, string? dataEpoch = null, bool requireConfigured = false) =>
        $"{Epoch(dataEpoch, requireConfigured)}:group:{groupId}:events";

    public static string PublicUpcomingEvents(string? dataEpoch = null, bool requireConfigured = false) =>
        $"{Epoch(dataEpoch, requireConfigured)}:public:upcoming";
}
