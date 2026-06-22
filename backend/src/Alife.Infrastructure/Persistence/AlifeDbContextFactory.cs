using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Alife.Infrastructure.Persistence;

public sealed class AlifeDbContextFactory : IDesignTimeDbContextFactory<AlifeDbContext>
{
	public AlifeDbContext CreateDbContext(string[] args)
	{
		var connectionString = Environment.GetEnvironmentVariable("ConnectionStrings__Default")
			?? "Server=localhost,14333;Database=alife;User Id=sa;Password=AlifeDevPass123;TrustServerCertificate=True;Encrypt=False";

		var options = new DbContextOptionsBuilder<AlifeDbContext>()
			.UseSqlServer(connectionString)
			.UseSnakeCaseNamingConvention()
			.Options;

		return new AlifeDbContext(options);
	}
}
