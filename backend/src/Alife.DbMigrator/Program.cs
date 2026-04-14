using Alife.Infrastructure;
using Alife.Infrastructure.Persistence;
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

using var host = builder.Build();
using var scope = host.Services.CreateScope();

await EnsureSqlServerDatabaseExistsAsync(connectionString);

var dbContext = scope.ServiceProvider.GetRequiredService<AlifeDbContext>();
await dbContext.Database.MigrateAsync();
var seedSummary = await SeedData.EnsureSeededAsync(dbContext);

Console.WriteLine(
    $"Seed summary: baselineSeeded={seedSummary.BaselineSeeded}; " +
    $"targetPhone={seedSummary.TargetPhoneE164}; " +
    $"memberFound={seedSummary.TargetMemberFound}; " +
    $"pagesFound={seedSummary.TargetMemberPagesFound}; " +
    $"sectionsInserted={seedSummary.SectionsInserted}");

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
