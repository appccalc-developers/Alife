using Alife.Application.Events.Services;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Alife.Tests.Unit.Events;

public sealed class EventPreparationArtifactTests
{
    [Fact]
    public void PreparationSource_PreservesLegacyCompositionAndExcludesDestructiveMigration()
    {
        Assert.Equal("1.1.0", EventCompositionDefinitions.SchemaVersion);
        Assert.Equal("1.0.0", EventCompositionDefinitions.LegacySchemaVersion);

        using var db = new AlifeDbContext(new DbContextOptionsBuilder<AlifeDbContext>()
            .UseSqlServer("Server=localhost;Database=not-connected;Integrated Security=true;Encrypt=false")
            .Options);
        Assert.DoesNotContain("20261012225333_Event2RemoveLegacyEventStorage", db.Database.GetMigrations());
    }
}
