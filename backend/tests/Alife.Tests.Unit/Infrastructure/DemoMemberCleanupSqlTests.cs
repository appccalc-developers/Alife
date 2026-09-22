using Microsoft.Data.SqlClient;

namespace Alife.Tests.Unit.Infrastructure;

public sealed class DemoMemberCleanupSqlTests
{
    [LocalCleanupTheory]
    [InlineData(false, "none")]
    [InlineData(true, "none")]
    [InlineData(true, "guid")]
    [InlineData(true, "json")]
    [InlineData(true, "cascade")]
    [InlineData(true, "identity")]
    public async Task CleanupIsAtomicAndPreservesUnrelatedRows(bool apply, string blocker)
    {
        var database = "AlifeDemoCleanupTest_" + Guid.NewGuid().ToString("N");
        var builder = new SqlConnectionStringBuilder
        {
            DataSource = "localhost,14333", InitialCatalog = "master", UserID = "sa",
            Password = Environment.GetEnvironmentVariable("ALIFE_LOCAL_SQL_PASSWORD") ?? "AlifeDevPass123",
            TrustServerCertificate = true, Encrypt = false, Pooling = false
        };
        var master = builder.ConnectionString;
        await Execute(master, $"CREATE DATABASE [{database}]");
        builder.InitialCatalog = database;
        try
        {
            await Execute(builder.ConnectionString, """
                CREATE TABLE dbo.members(id uniqueidentifier PRIMARY KEY,display_name nvarchar(150),
                    email nvarchar(200),phone_e164 nvarchar(30),created_utc datetime2);
                INSERT dbo.members VALUES
                    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee12',N'张伟恩 Nathan Zhang','nathan.zhang@alife.local','+640000000012',SYSUTCDATETIME()),
                    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',N'Real member','real@example.test','+64123456789',SYSUTCDATETIME());
                CREATE TABLE dbo.group_memberships(id uniqueidentifier PRIMARY KEY,group_id uniqueidentifier,member_id uniqueidentifier REFERENCES dbo.members(id));
                INSERT dbo.group_memberships VALUES(NEWID(),NEWID(),'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee12'),
                    (NEWID(),NEWID(),'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
                CREATE TABLE dbo.member_activation_invitations(id uniqueidentifier PRIMARY KEY,member_id uniqueidentifier REFERENCES dbo.members(id));
                INSERT dbo.member_activation_invitations VALUES('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb','eeeeeeee-eeee-eeee-eeee-eeeeeeeeee12');
                CREATE TABLE dbo.activation_group_grants(id uniqueidentifier PRIMARY KEY,activation_invitation_id uniqueidentifier REFERENCES dbo.member_activation_invitations(id));
                INSERT dbo.activation_group_grants VALUES(NEWID(),'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
                """);
            var extra = blocker switch
            {
                "guid" => "CREATE TABLE dbo.shared(id uniqueidentifier PRIMARY KEY,actor_member_id uniqueidentifier); INSERT dbo.shared VALUES(NEWID(),'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee12');",
                "json" => "CREATE TABLE dbo.shared(id uniqueidentifier PRIMARY KEY,payload nvarchar(max)); INSERT dbo.shared VALUES(NEWID(),N'{\"memberId\":\"EEEEEEEEEEEEEEEEEEEEEEEEEEEEEE12\"}');",
                "cascade" => "CREATE TABLE dbo.shared(id uniqueidentifier PRIMARY KEY,invitation_id uniqueidentifier REFERENCES dbo.member_activation_invitations(id) ON DELETE CASCADE); INSERT dbo.shared VALUES(NEWID(),'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');",
                "identity" => "UPDATE dbo.members SET display_name=N'Changed' WHERE id='eeeeeeee-eeee-eeee-eeee-eeeeeeeeee12';",
                _ => "SELECT 1;"
            };
            await Execute(builder.ConnectionString, extra);
            var root = new DirectoryInfo(AppContext.BaseDirectory);
            while (root is not null && !File.Exists(Path.Combine(root.FullName, "scripts", "cleanup-demo-members.sql"))) root = root.Parent;
            Assert.NotNull(root);
            var sql = await File.ReadAllTextAsync(Path.Combine(root.FullName, "scripts", "cleanup-demo-members.sql"));
            if (apply)
                sql = sql.Replace("DECLARE @Apply bit = 0;", "DECLARE @Apply bit = 1;")
                    .Replace("DECLARE @ExpectedDatabase sysname = N'';", $"DECLARE @ExpectedDatabase sysname = N'{database}';")
                    .Replace("DECLARE @MaintenanceAndBackupConfirmed bit = 0;", "DECLARE @MaintenanceAndBackupConfirmed bit = 1;");
            if (apply && blocker != "none")
            {
                var error = await Assert.ThrowsAsync<SqlException>(() => Execute(builder.ConnectionString, sql));
                Assert.Equal(51000, error.Number);
            }
            else
                await Execute(builder.ConnectionString, sql);
            var removed = apply && blocker == "none";
            Assert.Equal(removed ? 1 : 2, await Count(builder.ConnectionString, "members"));
            Assert.Equal(removed ? 1 : 2, await Count(builder.ConnectionString, "group_memberships"));
            Assert.Equal(removed ? 0 : 1, await Count(builder.ConnectionString, "activation_group_grants"));
            Assert.Equal(removed ? 0 : 1, await Count(builder.ConnectionString, "member_activation_invitations"));
            if (removed) await Execute(builder.ConnectionString, sql); // Idempotent rerun.
        }
        finally
        {
            if (builder.DataSource != "localhost,14333" || !database.StartsWith("AlifeDemoCleanupTest_"))
                throw new InvalidOperationException("Refusing cleanup outside the disposable local test database.");
            await Execute(master, $"DROP DATABASE [{database}]");
        }
    }

    private static async Task Execute(string connection, string sql)
    {
        await using var db = new SqlConnection(connection);
        await db.OpenAsync();
        await using var command = new SqlCommand(sql, db) { CommandTimeout = 120 };
        await command.ExecuteNonQueryAsync();
    }

    private static async Task<int> Count(string connection, string table)
    {
        await using var db = new SqlConnection(connection);
        await db.OpenAsync();
        await using var command = new SqlCommand($"SELECT COUNT(*) FROM dbo.[{table}]", db);
        return (int)(await command.ExecuteScalarAsync())!;
    }

    private sealed class LocalCleanupTheoryAttribute : TheoryAttribute
    {
        public LocalCleanupTheoryAttribute()
        {
            if (Environment.GetEnvironmentVariable("ALIFE_TEST_DEMO_CLEANUP_SQL") != "1")
                Skip = "Opt in with ALIFE_TEST_DEMO_CLEANUP_SQL=1 on the approved disposable local SQL server.";
        }
    }
}
