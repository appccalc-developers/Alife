using Alife.Application.Common.Interfaces;
using Alife.Application.Abstractions.Integrations;
using Alife.Application.Abstractions.Security;
using Alife.Application.ContentPosts.Services;
using Alife.Application.Events.Services;
using Alife.Application.FileAssets.Services;
using Alife.Application.ChurchLife;
using Alife.Application.IdentityAccess;
using Alife.Application.Forum.Services;
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
		services.AddHybridCache();
		services.AddHttpClient<ISundayBulletinStorage, SundayBulletinStorage>(client => client.Timeout = TimeSpan.FromSeconds(60));
		services.AddDbContext<AlifeDbContext>(options =>
			options
				.UseSqlServer(configuration.GetConnectionString("Default"))
				.UseSnakeCaseNamingConvention());
		services.AddScoped<IAlifeDbContext>(sp => sp.GetRequiredService<AlifeDbContext>());

		services.AddScoped<IJwtTokenService, JwtTokenService>();
		services.AddSingleton<IIdentityAccessConfiguration, IdentityAccessConfiguration>();
		services.AddSingleton<IIdentityTokenService, IdentityTokenService>();
		services.AddScoped<IServerRateLimiter, SqlServerRateLimiter>();
		services.AddScoped<IIdentitySerializableExecutor, IdentitySerializableExecutor>();
		services.AddScoped<IIdentityMessageSender, UnavailableIdentityMessageSender>();
		services.AddScoped<IPasskeyService, PasskeyService>();

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
		services.AddHttpClient<ICloudflareSpeedLayerCacheService, CloudflareSpeedLayerCacheService>(client =>
		{
			client.Timeout = TimeSpan.FromSeconds(10);
		});
		services.AddScoped<IGroupReadService, GroupReadService>();
		services.AddScoped<IFileStorageProviderResolver, FileStorageProviderResolver>();
		services.AddScoped<IFileAssetAccessUrlSigner, FileAssetAccessUrlSigner>();
		services.AddHttpClient<IFileAssetObjectMover, FileAssetObjectMover>(client =>
		{
			client.BaseAddress = new Uri((configuration["FileAssets:ImageApiBaseUrl"] ?? "https://images.ccalc.live").TrimEnd('/'));
			client.Timeout = TimeSpan.FromSeconds(30);
		});
		services.AddScoped<IGroupCacheInvalidationService, GroupCacheInvalidationService>();
		services.AddScoped<IGroupAuthorizationService, GroupAuthorizationService>();
		services.AddScoped<IForumAuthorizationService, ForumAuthorizationService>();
		services.AddScoped<IMemberReadService, MemberReadService>();
		services.AddScoped<IPageReadService, PageReadService>();
		services.AddScoped<IPageCacheInvalidationService, PageCacheInvalidationService>();
		services.AddScoped<IContentPostReadService, ContentPostReadService>();
		services.AddScoped<IContentPostCacheInvalidationService, ContentPostCacheInvalidationService>();
		services.AddScoped<IEventReadService, EventReadService>();
		services.AddScoped<IEventCacheInvalidationService, EventCacheInvalidationService>();
		services.AddScoped<ISermonReadService, SermonReadService>();
		services.AddScoped<ISermonCacheInvalidationService, SermonCacheInvalidationService>();

		return services;
	}
}
