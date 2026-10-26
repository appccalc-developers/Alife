using Alife.Application.Pages.Services;
using Alife.Application.IdentityAccess;
using Alife.Application.Sermons.Services;
using Alife.Application.Events.Services;
using Alife.Infrastructure;
using Alife.Infrastructure.Persistence;
using Alife.DbMigrator;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

var builder = Host.CreateApplicationBuilder(args);

// Explicitly set the base path for configuration
var configPath = AppContext.BaseDirectory;
builder.Configuration
    .SetBasePath(configPath)
    .AddEnvironmentVariables()
    .AddCommandLine(args);

var connectionString = builder.Configuration.GetConnectionString("Default");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "Missing required connection string 'ConnectionStrings:Default'. " +
        "Set it in appsettings or via the environment variable ConnectionStrings__Default.");
}

builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddScoped<IIdentityAccessService, IdentityAccessService>();

using var host = builder.Build();
using var scope = host.Services.CreateScope();

// Read-only, offline binding check for standalone maintenance. It parses the
// configured connection without logging it or touching the database.
if (await EventResetTargetIdentityInspection.TryRunAsync(builder.Configuration, args, connectionString))
    return;

// This exact one-migration command never reaches normal migration, seed,
// sermon normalization or cache invalidation below.
if (Event2MigrationOnly.TryCreate(builder.Configuration, args, connectionString, out var event2MigrationOnly))
{
    await event2MigrationOnly!.RunAsync(scope.ServiceProvider.GetRequiredService<AlifeDbContext>());
    return;
}

// The Event 2.0 reset is an independent maintenance command. Both isolated Event
// paths remain before ordinary migration, seed, normalization and cache work.
if (EventInstancePurge.TryCreate(builder.Configuration, args, connectionString, out var eventPurge))
{
    await eventPurge!.RunAsync();
    return;
}

// Read-only deployment gate for the one destructive Event 2.0 storage migration.
// Inspect the live database before the deployment decides whether to authorize migration.
var event2MigrationGate = builder.Configuration["Events:Event2MigrationGate"];
if (event2MigrationGate is not null)
{
    if (!args.Any(argument => string.Equals(argument, "--Events:Event2MigrationGate=inspect", StringComparison.Ordinal)) ||
        event2MigrationGate != "inspect")
        throw new InvalidOperationException("The Event 2.0 migration gate requires the explicit inspect command.");
    var outputValue = builder.Configuration["Events:OutputDirectory"] ??
        throw new InvalidOperationException("Events:OutputDirectory is required for migration-gate inspection.");
    if (!Path.IsPathFullyQualified(outputValue))
        throw new InvalidOperationException("Events:OutputDirectory must be absolute for migration-gate inspection.");
    var outputDirectory = Path.GetFullPath(outputValue);
    Directory.CreateDirectory(outputDirectory);
    var gateDb = scope.ServiceProvider.GetRequiredService<AlifeDbContext>();
    var known = gateDb.Database.GetMigrations().Contains(Event2DestructiveMigrationGate.MigrationId, StringComparer.Ordinal);
    var applied = (await gateDb.Database.GetAppliedMigrationsAsync()).Contains(Event2DestructiveMigrationGate.MigrationId, StringComparer.Ordinal);
    var pendingMigrationIds = (await gateDb.Database.GetPendingMigrationsAsync()).ToArray();
    var inspection = known && !applied
        ? await EventInstancePurge.InspectForMigrationAsync(connectionString)
        : null;
    var result = new
    {
        migrationId = Event2DestructiveMigrationGate.MigrationId,
        known,
        applied,
        pending = known && !applied,
        pendingMigrationIds,
        instanceDataEmpty = inspection?.InstanceDataEmpty,
        schemaProfile = inspection?.SchemaProfile,
        rowCounts = inspection?.RowCounts
    };
    await File.WriteAllTextAsync(
        Path.Combine(outputDirectory, "event2-migration-gate.json"),
        System.Text.Json.JsonSerializer.Serialize(result));
    Console.WriteLine($"Event 2.0 migration gate inspected: known={known}; applied={applied}; " +
        $"pending={known && !applied}; instanceDataEmpty={inspection?.InstanceDataEmpty}.");
    return;
}

// Explicit local questionnaire-version initialization. No schema migration or unrelated seeding.
var questionnaireMode = builder.Configuration["Events:QuestionnaireVersions"];
if (questionnaireMode is not null)
{
    if (!args.Any(argument => argument.StartsWith("--Events:QuestionnaireVersions=", StringComparison.Ordinal)) ||
        questionnaireMode is not ("preview" or "apply"))
        throw new InvalidOperationException("Questionnaire versions require an explicit preview or apply command.");
    var target = new SqlConnectionStringBuilder(connectionString);
    if (!string.Equals(target.DataSource, "localhost,14333", StringComparison.OrdinalIgnoreCase) ||
        !string.Equals(target.InitialCatalog, "alife_db", StringComparison.OrdinalIgnoreCase) ||
        builder.Configuration["Events:ExpectedServer"] != target.DataSource ||
        builder.Configuration["Events:ExpectedDatabase"] != target.InitialCatalog)
        throw new InvalidOperationException("Questionnaire initialization is restricted to localhost,14333/alife_db.");
    if (questionnaireMode == "apply")
    {
        var backupPath = Path.GetFullPath(builder.Configuration["Events:VerifiedBackupPath"] ??
            throw new InvalidOperationException("A verified recovery backup path is required."));
        var backupRoot = Path.GetFullPath("C:/Data/Alife/Backups").TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        if (!backupPath.StartsWith(backupRoot, StringComparison.OrdinalIgnoreCase) ||
            !File.Exists(backupPath) || new FileInfo(backupPath).Length == 0)
            throw new InvalidOperationException("The verified local recovery backup is missing.");
    }
    var questionnaireDb = scope.ServiceProvider.GetRequiredService<AlifeDbContext>();
    if ((await questionnaireDb.Database.GetPendingMigrationsAsync()).Any())
        throw new InvalidOperationException("Apply separately reviewed schema migrations before questionnaire initialization.");
    var initialized = await EventActivityTemplateCatalog.InitializeQuestionnaireVersionsAsync(
        questionnaireDb, default, apply: questionnaireMode == "apply");
    Console.WriteLine($"Questionnaire {questionnaireMode}: target={target.DataSource}/{target.InitialCatalog}; template successors={initialized}.");
    return;
}

// Explicit recovery does not run migrations, seeding, or unrelated cache mutations.
var recoverAdministrator = args.Any(argument => string.Equals(argument, "--AdministratorActivation:Recover=true", StringComparison.OrdinalIgnoreCase));
if (builder.Configuration.GetValue<bool>("AdministratorActivation:Recover") && !recoverAdministrator)
    throw new InvalidOperationException("Administrator recovery requires an explicit --AdministratorActivation:Recover=true command-line argument.");
if (recoverAdministrator)
{
    var recovery = await scope.ServiceProvider.GetRequiredService<IIdentityAccessService>().InitializeAdministratorAsync(true, default);
    Console.WriteLine(recovery.IsSuccess ? "Administrator recovery email accepted." : recovery.Message);
    Environment.ExitCode = recovery.IsSuccess ? 0 : 1;
    return;
}

if (builder.Configuration.GetValue<bool>("Sermons:NormalizeOnly"))
{
    var sermonDb = scope.ServiceProvider.GetRequiredService<AlifeDbContext>();
    var count = await SermonMetadataBackfill.RunAsync(sermonDb, scope.ServiceProvider.GetRequiredService<ISermonCacheInvalidationService>());
    Console.WriteLine($"Sermon metadata normalized: {count}.");
    return;
}

await EnsureSqlServerDatabaseExistsAsync(connectionString);

var dbContext = scope.ServiceProvider.GetRequiredService<AlifeDbContext>();
var pendingMigrations = await dbContext.Database.GetPendingMigrationsAsync();
// Environment variables or appsettings cannot authorize this migration. Even with the
// literal command-line switch, every Event instance table and known Event soft reference
// must be empty before EF applies any pending migration. The migration's SQL guard remains
// as the final race backstop.
Event2DestructiveMigrationGate.RequireExplicitAuthorization(pendingMigrations, args);
if (pendingMigrations.Contains(Event2DestructiveMigrationGate.MigrationId, StringComparer.Ordinal))
{
    var inspection = await EventInstancePurge.InspectForMigrationAsync(connectionString);
    Event2DestructiveMigrationGate.RequireEmptyInstanceInspection(inspection.InstanceDataEmpty);
}
await dbContext.Database.MigrateAsync();
var normalizedSermons = await SermonMetadataBackfill.RunAsync(dbContext, scope.ServiceProvider.GetRequiredService<ISermonCacheInvalidationService>());
Console.WriteLine($"Sermon metadata normalized: {normalizedSermons}.");
var seedSummary = await SeedData.EnsureSeededAsync(dbContext, builder.Configuration);
// Copy each current administrator-edited template to a new version exactly once.
// The archived version and every accepted Event plan remain untouched.
var initializedProjectTemplates = await EventActivityTemplateCatalog.InitializePresetProjectVersionsAsync(dbContext, default);
Console.WriteLine($"Event project template versions initialized: {initializedProjectTemplates}.");
var initializedEvent2Templates = await EventActivityTemplateCatalog.InitializeQuestionnaireVersionsAsync(dbContext, default);
Console.WriteLine($"Event 2.0 template versions initialized: {initializedEvent2Templates}.");
if (builder.Configuration.GetValue<bool>("AdministratorActivation:Enabled"))
{
    var activation = await scope.ServiceProvider.GetRequiredService<IIdentityAccessService>().InitializeAdministratorAsync(false, default);
    Console.WriteLine(activation.IsSuccess ? "Administrator initialization checked." : activation.Message);
    if (!activation.IsSuccess) Environment.ExitCode = 1;
}

// Seeders write directly through the DbContext, so they bypass the application
// commands that normally invalidate the public website's page caches.
var pageCacheInvalidationService = scope.ServiceProvider.GetRequiredService<IPageCacheInvalidationService>();
await pageCacheInvalidationService.RemovePublicAsync();

Console.WriteLine(
    $"Seed summary: baselineSeeded={seedSummary.BaselineSeeded}; " +
    $"targetPhone={seedSummary.TargetPhoneE164}; " +
    $"memberFound={seedSummary.TargetMemberFound}; " +
    $"pagesFound={seedSummary.TargetMemberPagesFound}; " +
    $"sectionsInserted={seedSummary.SectionsInserted}");

Console.WriteLine("Public page caches invalidated.");
Console.WriteLine("Migration and seed completed.");

static async Task EnsureSqlServerDatabaseExistsAsync(string connectionString)
{
    if (!connectionString.Contains("Server=", StringComparison.OrdinalIgnoreCase))
    {
        return;
    }

    var sqlConnectionBuilder = new SqlConnectionStringBuilder(connectionString);
    var databaseName = sqlConnectionBuilder.InitialCatalog;
    if (string.IsNullOrWhiteSpace(databaseName))
    {
        return;
    }

    if (ShouldSkipDatabaseCreation(connectionString, sqlConnectionBuilder.DataSource))
    {
        Console.WriteLine("Skipping database auto-create for Azure SQL / Entra auth connection.");
        return;
    }

    sqlConnectionBuilder.InitialCatalog = "master";

    await using var sqlConnection = new SqlConnection(sqlConnectionBuilder.ConnectionString);
    await sqlConnection.OpenAsync();

    const string createDatabaseSql = """
                                     IF DB_ID(@dbName) IS NULL
                                     BEGIN
                                         DECLARE @sql nvarchar(max) = N'CREATE DATABASE [' + REPLACE(@dbName, N']', N']]') + N']';
                                         EXEC (@sql);
                                     END
                                     """;

    await using var command = new SqlCommand(createDatabaseSql, sqlConnection);
    command.Parameters.AddWithValue("@dbName", databaseName);
    await command.ExecuteNonQueryAsync();
}

static bool ShouldSkipDatabaseCreation(string connectionString, string? dataSource)
{
    if (string.IsNullOrWhiteSpace(dataSource))
    {
        return false;
    }

    var serverHost = dataSource.Trim();
    if (serverHost.StartsWith("tcp:", StringComparison.OrdinalIgnoreCase))
    {
        serverHost = serverHost[4..];
    }

    var portSeparatorIndex = serverHost.IndexOf(',');
    if (portSeparatorIndex > -1)
    {
        serverHost = serverHost[..portSeparatorIndex];
    }

    if (serverHost.EndsWith(".database.windows.net", StringComparison.OrdinalIgnoreCase))
    {
        return true;
    }

    return connectionString.Contains("Authentication=Active Directory", StringComparison.OrdinalIgnoreCase) ||
           connectionString.Contains("Authentication=\"Active Directory", StringComparison.OrdinalIgnoreCase);
}
