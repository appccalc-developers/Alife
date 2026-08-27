using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Alife.Application.Albums;
using Alife.Application.ChurchLife;
using Alife.Application.Events.Services;

namespace Alife.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(typeof(DependencyInjection).Assembly));
        services.AddScoped<IAlbumService, AlbumService>();
        services.AddScoped<IChurchLifeScopeService, ChurchLifeScopeService>();
        services.AddScoped<IChurchLifeService, ChurchLifeService>();
        services.AddSingleton<IEventCompositionEngine, EventCompositionEngine>();
        services.AddScoped<IEventActivityTemplateCatalog, EventActivityTemplateCatalog>();
        services.AddScoped<IEventOperationsService, EventOperationsService>();
        services.AddScoped<IEventVenueService, EventVenueService>();
        services.AddScoped<IEventTravelService, EventTravelService>();
        services.AddScoped<IEventSafeguardingService, EventSafeguardingService>();
        return services;
    }
}
