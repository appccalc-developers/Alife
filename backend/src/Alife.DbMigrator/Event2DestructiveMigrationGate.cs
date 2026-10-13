namespace Alife.DbMigrator;

public static class Event2DestructiveMigrationGate
{
    public const string MigrationId = "20261012225333_Event2RemoveLegacyEventStorage";
    public const string AllowArgument = "--Events:AllowEvent2DestructiveMigration=true";
    public const string VerifiedRunArgumentPrefix = "--Events:VerifiedResetRunId=";

    public static void RequireExplicitAuthorization(IEnumerable<string> pendingMigrations, IReadOnlyCollection<string> arguments)
    {
        if (!pendingMigrations.Contains(MigrationId, StringComparer.Ordinal)) return;

        var allowCount = arguments.Count(argument => string.Equals(argument, AllowArgument, StringComparison.Ordinal));
        var runArguments = arguments
            .Where(argument => argument.StartsWith(VerifiedRunArgumentPrefix, StringComparison.Ordinal))
            .ToArray();
        var runId = runArguments.Length == 1 ? runArguments[0][VerifiedRunArgumentPrefix.Length..] : string.Empty;

        if (allowCount != 1 || runArguments.Length != 1 || !IsIdentifier(runId))
        {
            throw new InvalidOperationException(
                "EVENT2_DESTRUCTIVE_RESET_REQUIRED: the Event 2.0 destructive migration may run only with " +
                "the explicit command-line authorization and verified reset run id from the protected final-release workflow.");
        }
    }

    private static bool IsIdentifier(string value) =>
        value.Length is >= 1 and <= 128 &&
        value.All(character => char.IsAsciiLetterOrDigit(character) || character is '.' or '_' or '-');
}
