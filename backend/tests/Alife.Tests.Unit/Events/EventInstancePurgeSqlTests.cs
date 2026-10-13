using System.Text.Json;
using Alife.DbMigrator;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

namespace Alife.Tests.Unit.Events;

public sealed class EventInstancePurgeSqlTests
{
    [LocalEventPurgeSqlFact]
    public async Task Current_profile_applies_verifies_and_repeats_as_no_op()
    {
        await using var fixture = await DatabaseFixture.CreateAsync();
        await fixture.SeedEventAsync();
        var output = fixture.Output("apply-no-op");

        var preview = await fixture.PreviewAsync(output, "apply-no-op");
        Assert.Equal("event-2.0", preview.SchemaProfile);
        Assert.Single(preview.EventIds);

        await fixture.Purge(output, EventInstancePurge.PurgeMode.Apply, "apply-no-op", preview.Fingerprint).RunAsync();
        await fixture.Purge(output, EventInstancePurge.PurgeMode.Verify, "apply-no-op", preview.Fingerprint).RunAsync();
        await fixture.Purge(output, EventInstancePurge.PurgeMode.Apply, "apply-no-op", preview.Fingerprint).RunAsync();

        await using var db = fixture.OpenDb();
        Assert.Empty(await db.GroupEvents.IgnoreQueryFilters().ToListAsync());
        Assert.Equal(1, await db.Groups.CountAsync());
        Assert.Equal(1, await db.Members.CountAsync());
    }

    [LocalEventPurgeSqlFact]
    public async Task Unknown_inbound_foreign_key_stops_preview()
    {
        await using var fixture = await DatabaseFixture.CreateAsync();
        await fixture.SeedEventAsync();
        await fixture.ExecuteAsync("""
            CREATE TABLE [dbo].[purge_probe]
            (
                [id] uniqueidentifier NOT NULL CONSTRAINT [pk_purge_probe] PRIMARY KEY,
                [root_id] uniqueidentifier NOT NULL,
                CONSTRAINT [fk_purge_probe_group_events_root_id]
                    FOREIGN KEY ([root_id]) REFERENCES [dbo].[group_events]([id])
            );
            """);

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            fixture.Purge(fixture.Output("unknown-fk"), EventInstancePurge.PurgeMode.Preview, "unknown-fk").RunAsync());

        Assert.Contains("Unclassified foreign keys", exception.Message, StringComparison.Ordinal);
        await using var db = fixture.OpenDb();
        Assert.Equal(1, await db.GroupEvents.CountAsync());
    }

    [LocalEventPurgeSqlFact]
    public async Task Optional_table_may_be_absent_but_known_table_shape_change_stops_preview()
    {
        await using var fixture = await DatabaseFixture.CreateAsync();
        await fixture.ExecuteAsync("DROP TABLE [dbo].[event_activity_consents];");
        Assert.Equal("event-2.0", await fixture.InspectProfileAsync());

        await fixture.ExecuteAsync("ALTER TABLE [dbo].[group_events] ADD [unexpected_reset_column] nvarchar(40) NULL;");
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            fixture.Purge(fixture.Output("shape-change"), EventInstancePurge.PurgeMode.Preview, "shape-change").RunAsync());

        Assert.Contains("does not match a reviewed reset profile", exception.Message, StringComparison.Ordinal);
        Assert.Contains("schemaEvidence=", exception.Message, StringComparison.Ordinal);
    }

    [LocalEventPurgeSqlFact]
    public async Task Orphaned_event_scope_delegation_stops_preview_without_disclosing_id()
    {
        await using var fixture = await DatabaseFixture.CreateAsync();
        var seeded = await fixture.SeedEventAsync();
        var orphanScopeId = Guid.NewGuid();
        await using (var db = fixture.OpenDb())
        {
            db.EventPackageApprovalDelegations.Add(new EventPackageApprovalDelegation
            {
                Id = Guid.NewGuid(),
                OrganisationId = seeded.GroupId,
                ScopeType = EventPackageDelegationScopeType.Event,
                ScopeId = orphanScopeId,
                DelegatedToMemberId = seeded.MemberId,
                GrantedByMemberId = seeded.MemberId,
                StartsUtc = DateTime.UtcNow.AddMinutes(-1),
                ExpiresUtc = DateTime.UtcNow.AddMinutes(30),
                GrantedUtc = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            fixture.Purge(fixture.Output("orphan"), EventInstancePurge.PurgeMode.Preview, "orphan").RunAsync());

        Assert.Contains("orphaned Event approval delegations", exception.Message, StringComparison.Ordinal);
        Assert.DoesNotContain(orphanScopeId.ToString("D"), exception.ToString(), StringComparison.OrdinalIgnoreCase);
    }

    [LocalEventPurgeSqlFact]
    public async Task Malformed_activity_plan_error_uses_evidence_hash_instead_of_event_id()
    {
        await using var fixture = await DatabaseFixture.CreateAsync();
        var seeded = await fixture.SeedEventAsync();
        await using (var db = fixture.OpenDb())
        {
            db.EventActivityPlans.Add(new EventActivityPlan
            {
                EventId = seeded.EventId,
                DataJson = "not-json",
                UpdatedUtc = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
        }

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            fixture.Purge(fixture.Output("redaction"), EventInstancePurge.PurgeMode.Preview, "redaction").RunAsync());

        Assert.Contains("evidence=", exception.Message, StringComparison.Ordinal);
        Assert.DoesNotContain(seeded.EventId.ToString("D"), exception.ToString(), StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("not-json", exception.ToString(), StringComparison.Ordinal);
    }

    [LocalEventPurgeSqlFact]
    public async Task Fingerprint_drift_rolls_back_without_deleting_either_event()
    {
        await using var fixture = await DatabaseFixture.CreateAsync();
        await fixture.SeedEventAsync();
        var output = fixture.Output("drift");
        var preview = await fixture.PreviewAsync(output, "drift");
        await fixture.SeedEventAsync();

        var exception = await Assert.ThrowsAsync<InvalidOperationException>(() =>
            fixture.Purge(output, EventInstancePurge.PurgeMode.Apply, "drift", preview.Fingerprint).RunAsync());

        Assert.Contains("does not match the approved fingerprint", exception.Message, StringComparison.Ordinal);
        await using var db = fixture.OpenDb();
        Assert.Equal(2, await db.GroupEvents.CountAsync());
    }

    [LocalEventPurgeSqlFact]
    public async Task Reviewed_legacy_profiles_match_their_isolated_migration_databases()
    {
        var expected = new[]
        {
            ("20260915101331_EventActivityPlanningSources", "legacy-67"),
            ("20261011113522_AddEventProjectOperations", "legacy-75")
        };
        foreach (var (migration, profile) in expected)
        {
            await using var fixture = await MigrationProfileFixture.CreateAsync(migration);
            Assert.Equal(profile, await fixture.InspectProfileAsync());
        }
    }

    private sealed class DatabaseFixture : IAsyncDisposable
    {
        private const string Prefix = "AlifeEventPurgeTest_";
        private readonly string _database = Prefix + Guid.NewGuid().ToString("N");
        private readonly string _outputRoot = Path.GetFullPath(
            Environment.GetEnvironmentVariable("ALIFE_EVENT_PURGE_TEST_OUTPUT_ROOT")
            ?? @"C:\Data\Alife\Temp\EventPurgeTests");

        private DatabaseFixture() { }

        public static async Task<DatabaseFixture> CreateAsync()
        {
            var fixture = new DatabaseFixture();
            try
            {
                var master = new SqlConnectionStringBuilder(ConnectionString("master"));
                await using (var connection = new SqlConnection(master.ConnectionString))
                {
                    await connection.OpenAsync();
                    await using var command = new SqlCommand(
                        $"DBCC CLONEDATABASE (N'alife_db', N'{fixture._database}') WITH VERIFY_CLONEDB; " +
                        $"ALTER DATABASE [{fixture._database}] SET READ_WRITE WITH NO_WAIT;", connection)
                    {
                        CommandTimeout = 0
                    };
                    await command.ExecuteNonQueryAsync();
                }
                await fixture.ExecuteAsync("""
                    DELETE FROM [dbo].[__EFMigrationsHistory];
                    INSERT INTO [dbo].[__EFMigrationsHistory] ([migration_id], [product_version])
                    VALUES (N'20261012225333_Event2RemoveLegacyEventStorage', N'10.0.4');
                    """);
                return fixture;
            }
            catch
            {
                await DropFixtureDatabaseAsync(fixture._database);
                throw;
            }
        }

        public AlifeDbContext OpenDb() => new(new DbContextOptionsBuilder<AlifeDbContext>()
            .UseSqlServer(ConnectionString(_database))
            .UseSnakeCaseNamingConvention()
            .Options);

        public static string ConnectionString(string database) => new SqlConnectionStringBuilder
        {
            DataSource = "localhost,14333",
            InitialCatalog = database,
            UserID = "sa",
            Password = Environment.GetEnvironmentVariable("ALIFE_LOCAL_SQL_PASSWORD") ?? "AlifeDevPass123",
            TrustServerCertificate = true,
            Encrypt = false,
            ConnectTimeout = 5
        }.ConnectionString;

        public async Task<Seed> SeedEventAsync()
        {
            await using var db = OpenDb();
            var group = await db.Groups.SingleOrDefaultAsync();
            var member = await db.Members.SingleOrDefaultAsync();
            if (group is null)
            {
                group = new Group { Id = Guid.NewGuid(), NameJson = "{}" };
                db.Groups.Add(group);
            }
            if (member is null)
            {
                member = new Member { Id = Guid.NewGuid(), DisplayName = "Event purge SQL fixture" };
                db.Members.Add(member);
            }
            var item = new GroupEvent
            {
                Id = Guid.NewGuid(),
                GroupId = group.Id,
                CreatedByMemberId = member.Id,
                AccountableOwnerMemberId = member.Id,
                TitleEn = "Fixture",
                TitleZh = "Fixture",
                StartDate = DateTime.UtcNow.AddDays(1),
                EndDate = DateTime.UtcNow.AddDays(1).AddHours(1),
                EventDataJson = "{}",
                CreatedUtc = DateTime.UtcNow,
                UpdatedUtc = DateTime.UtcNow
            };
            db.GroupEvents.Add(item);
            db.EventFactSets.Add(new EventFactSet
            {
                Id = Guid.NewGuid(),
                EventId = item.Id,
                Version = 1,
                SchemaVersion = "2.0.0",
                FactsJson = "[]",
                SourceHash = "purge-sql-fixture",
                CreatedByMemberId = member.Id,
                CreatedUtc = DateTime.UtcNow
            });
            await db.SaveChangesAsync();
            return new(group.Id, member.Id, item.Id);
        }

        public string Output(string name) => Path.Combine(_outputRoot, _database, name);

        public EventInstancePurge Purge(
            string output,
            EventInstancePurge.PurgeMode mode,
            string run,
            string? expectedFingerprint = null) =>
            EventInstancePurge.CreateForIsolatedIntegrationTest(
                ConnectionString(_database), output, mode, run, expectedFingerprint);

        public async Task<EventInstancePurge.Manifest> PreviewAsync(string output, string run)
        {
            await Purge(output, EventInstancePurge.PurgeMode.Preview, run).RunAsync();
            return JsonSerializer.Deserialize<EventInstancePurge.Manifest>(
                await File.ReadAllTextAsync(Path.Combine(output, "preview.json")),
                new JsonSerializerOptions(JsonSerializerDefaults.Web))!;
        }

        public async Task ExecuteAsync(string sql)
        {
            await using var connection = new SqlConnection(ConnectionString(_database));
            await connection.OpenAsync();
            await using var command = new SqlCommand(sql, connection) { CommandTimeout = 0 };
            await command.ExecuteNonQueryAsync();
        }

        public async Task<string> InspectProfileAsync()
        {
            await using var connection = new SqlConnection(ConnectionString(_database));
            await connection.OpenAsync();
            return await EventInstancePurge.InspectReviewedSchemaProfileAsync(connection);
        }

        public async ValueTask DisposeAsync()
        {
            if (!_database.StartsWith(Prefix, StringComparison.Ordinal) || _database.Length != Prefix.Length + 32)
                throw new InvalidOperationException("Refusing to delete a non-fixture Event purge database.");
            var master = new SqlConnectionStringBuilder(ConnectionString(_database)) { InitialCatalog = "master" };
            await using (var connection = new SqlConnection(master.ConnectionString))
            {
                await connection.OpenAsync();
                await using var command = new SqlCommand(
                    $"ALTER DATABASE [{_database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{_database}];", connection);
                await command.ExecuteNonQueryAsync();
            }
            var output = Path.Combine(_outputRoot, _database);
            if (Directory.Exists(output) && Path.GetFullPath(output).StartsWith(_outputRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
                Directory.Delete(output, recursive: true);
        }
    }

    private sealed record Seed(Guid GroupId, Guid MemberId, Guid EventId);

    private sealed class MigrationProfileFixture : IAsyncDisposable
    {
        private const string Prefix = "AlifeEventPurgeTest_";
        private readonly string _database = Prefix + Guid.NewGuid().ToString("N");

        private MigrationProfileFixture() { }

        public static async Task<MigrationProfileFixture> CreateAsync(string targetMigration)
        {
            var fixture = new MigrationProfileFixture();
            try
            {
                await using var db = new AlifeDbContext(new DbContextOptionsBuilder<AlifeDbContext>()
                    .UseSqlServer(DatabaseFixture.ConnectionString(fixture._database))
                    .UseSnakeCaseNamingConvention()
                    .Options);
                var migrator = db.GetService<IMigrator>();
                await migrator.MigrateAsync("20260707074250_AddPagePublicationReviews");
                await using (var connection = new SqlConnection(DatabaseFixture.ConnectionString(fixture._database)))
                {
                    await connection.OpenAsync();
                    await using var command = new SqlCommand("""
                        INSERT [dbo].[groups]
                            ([id], [parent_group_id], [access_type], [is_church], [is_closed],
                             [created_utc], [updated_utc], [description_json], [name_json])
                        VALUES
                            (NEWID(), NULL, 0, 1, 0, SYSUTCDATETIME(), SYSUTCDATETIME(), NULL, N'{}');
                        """, connection);
                    await command.ExecuteNonQueryAsync();
                }
                await migrator.MigrateAsync(targetMigration);
                return fixture;
            }
            catch
            {
                await DropFixtureDatabaseAsync(fixture._database);
                throw;
            }
        }

        public async Task<string> InspectProfileAsync()
        {
            await using var connection = new SqlConnection(DatabaseFixture.ConnectionString(_database));
            await connection.OpenAsync();
            return await EventInstancePurge.InspectReviewedSchemaProfileAsync(connection);
        }

        public async ValueTask DisposeAsync() => await DropFixtureDatabaseAsync(_database);
    }

    private sealed class LocalEventPurgeSqlFactAttribute : FactAttribute
    {
        public LocalEventPurgeSqlFactAttribute()
        {
            if (!string.Equals(Environment.GetEnvironmentVariable("ALIFE_TEST_EVENT_PURGE_SQL"), "1", StringComparison.Ordinal))
                Skip = "Opt in with ALIFE_TEST_EVENT_PURGE_SQL=1; uses disposable localhost SQL databases.";
        }
    }

    private static async Task DropFixtureDatabaseAsync(string database)
    {
        const string prefix = "AlifeEventPurgeTest_";
        if (!database.StartsWith(prefix, StringComparison.Ordinal) || database.Length != prefix.Length + 32)
            throw new InvalidOperationException("Refusing to delete a non-fixture Event purge database.");
        var master = new SqlConnectionStringBuilder(DatabaseFixture.ConnectionString(database)) { InitialCatalog = "master" };
        await using var connection = new SqlConnection(master.ConnectionString);
        await connection.OpenAsync();
        await using var command = new SqlCommand(
            $"IF DB_ID(N'{database}') IS NOT NULL BEGIN " +
            $"ALTER DATABASE [{database}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE [{database}]; END;", connection);
        await command.ExecuteNonQueryAsync();
    }
}
