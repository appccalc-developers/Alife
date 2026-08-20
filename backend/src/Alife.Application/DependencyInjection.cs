using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Alife.Application.Albums;
using Alife.Application.ChurchLife;

namespace Alife.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(DependencyInjection).Assembly));
        services.AddScoped<IAlbumService, AlbumService>();
        services.AddScoped<IChurchLifeScopeService, ChurchLifeScopeService>();
        services.AddScoped<IChurchLifeService, ChurchLifeService>();
        return services;
    }
}
