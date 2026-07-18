using Alife.Application.Pages.Services;
using Alife.Infrastructure;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Alife.Tests.Unit.Infrastructure;

public sealed class InfrastructureDependencyInjectionTests
{
    [Fact]
    public void AddInfrastructure_RegistersPageCacheInvalidationDependencies()
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:Default"] =
                    "Server=localhost;Database=AlifeDependencyInjectionTest;User Id=test;Password=test;TrustServerCertificate=True"
            })
            .Build();
        var services = new ServiceCollection();
        services.AddSingleton<IConfiguration>(configuration);
        services.AddLogging();
        services.AddInfrastructure(configuration);

        using var serviceProvider = services.BuildServiceProvider(
            new ServiceProviderOptions { ValidateScopes = true });
        using var scope = serviceProvider.CreateScope();

        var cacheInvalidationService =
            scope.ServiceProvider.GetRequiredService<IPageCacheInvalidationService>();

        Assert.NotNull(cacheInvalidationService);
    }
}
