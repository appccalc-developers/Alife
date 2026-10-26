namespace Alife.DbMigrator;

public static class Event2DestructiveMigrationGate
{
    public const string MigrationId = "20261012225333_Event2RemoveLegacyEventStorage";
    public const string AllowArgument = "--Events:AllowEvent2DestructiveMigration=true";

    public static void RequireExplicitAuthorization(IEnumerable<string> pendingMigrations, IReadOnlyCollection<string> arguments)
    {
        if (!pendingMigrations.Contains(MigrationId, StringComparer.Ordinal)) return;

        var allowCount = arguments.Count(argument => string.Equals(argument, AllowArgument, StringComparison.Ordinal));
        if (allowCount != 1 || arguments.Any(argument =>
                argument.StartsWith("--Events:VerifiedResetRunId=", StringComparison.Ordinal)))
        {
            throw new InvalidOperationException(
                "EVENT2_DESTRUCTIVE_RESET_REQUIRED: the Event 2.0 destructive migration may run only with " +
                "the explicit command-line authorization after a read-only empty-instance inspection.");
        }
    }

    public static void RequireEmptyInstanceInspection(bool instanceDataEmpty)
    {
        if (!instanceDataEmpty)
            throw new InvalidOperationException(
                "EVENT2_DESTRUCTIVE_RESET_REQUIRED: Event instance rows or Event-scoped references remain; " +
                "the Event 2.0 storage migration cannot proceed.");
    }
}
