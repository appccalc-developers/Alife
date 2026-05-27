using Alife.Application.Common.Interfaces;
using Alife.Application.Abstractions.Integrations;
using Alife.Application.Abstractions.Security;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Application.Members.Services;
using Alife.Application.Pages.Services;
using Alife.Application.Sermons.Services;
using Alife.Infrastructure.HostedServices;
using Alife.Infrastructure.Integrations;
using Alife.Infrastructure.Persistence;
using Alife.Infrastructure.ReadServices;
using Alife.Infrastructure.Security;
using Alife.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Alife.Infrastructure;

public static class DependencyInjection
{
	public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
	{
		services.AddDbContext<AlifeDbContext>(options =>
			options
				.UseSqlServer(configuration.GetConnectionString("Default"))
				.UseSnakeCaseNamingConvention());
		services.AddScoped<IAlifeDbContext>(sp => sp.GetRequiredService<AlifeDbContext>());

		services.AddScoped<IJwtTokenService, JwtTokenService>();

		services.AddHttpClient("youtube", client =>
		{
			client.BaseAddress = new Uri("https://www.googleapis.com/youtube/v3/");
			client.Timeout = TimeSpan.FromSeconds(20);
		});
		services.AddScoped<IYoutubeService, YoutubeService>();
		services.AddHttpClient<ILineLoginService, LineLoginService>(client =>
		{
			client.Timeout = TimeSpan.FromSeconds(15);
		});
		services.AddHttpClient<ICloudflareKvCacheService, CloudflareKvCacheService>(client =>
		{
			client.BaseAddress = new Uri("https://api.cloudflare.com/client/v4/");
			client.Timeout = TimeSpan.FromSeconds(10);

			var apiToken = configuration["Cloudflare:ApiToken"];
			if (!string.IsNullOrWhiteSpace(apiToken))
			{
				client.DefaultRequestHeaders.Authorization =
					new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", apiToken);
			}
		});
		services.AddScoped<IGroupReadService, GroupReadService>();
		services.AddScoped<IGroupCacheInvalidationService, GroupCacheInvalidationService>();
		services.AddScoped<IGroupAuthorizationService, GroupAuthorizationService>();
		services.AddScoped<IMemberReadService, MemberReadService>();
		services.AddScoped<IPageReadService, PageReadService>();
		services.AddScoped<IPageCacheInvalidationService, PageCacheInvalidationService>();
		services.AddScoped<IEventReadService, EventReadService>();
		services.AddScoped<IEventCacheInvalidationService, EventCacheInvalidationService>();
		services.AddScoped<ISermonReadService, SermonReadService>();
		services.AddScoped<ISermonCacheInvalidationService, SermonCacheInvalidationService>();

		return services;
	}
}
