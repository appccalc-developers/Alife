using System.Data;
using Alife.Application.Events.Services;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Alife.Api;

public interface IEventResetTargetIdentityProbe
{
    Task<string> ReadAsync(CancellationToken cancellationToken);
}

public sealed class SqlEventResetTargetIdentityProbe(AlifeDbContext db) : IEventResetTargetIdentityProbe
{
    public async Task<string> ReadAsync(CancellationToken cancellationToken)
    {
        if (!db.Database.IsRelational())
            throw new InvalidOperationException("Event reset target identity requires a relational database.");

        var connection = db.Database.GetDbConnection();
        var closeAfter = connection.State != ConnectionState.Open;
        if (closeAfter) await connection.OpenAsync(cancellationToken);
        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT DB_NAME();";
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            if (!await reader.ReadAsync(cancellationToken) || reader.IsDBNull(0))
                throw new InvalidOperationException("The Event reset database target identity probe returned no identity.");
            // Azure SQL's SERVERPROPERTY('ServerName') can identify the physical
            // host rather than the logical endpoint checked by the CLI/ARM gate.
            return EventResetTargetIdentity.CalculateHash(connection.DataSource, reader.GetString(0));
        }
        finally
        {
            if (closeAfter) await connection.CloseAsync();
        }
    }
}
