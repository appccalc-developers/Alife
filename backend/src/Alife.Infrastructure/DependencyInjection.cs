using Alife.Application.Common.Interfaces;
using Alife.Application.Abstractions.Integrations;
using Alife.Application.Abstractions.Security;
using Alife.Application.Groups.Services;
using Alife.Application.Members.Services;
using Alife.Application.Pages.Services;
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
		services
			.AddOptions<TwilioVerifyOptions>()
			.Bind(configuration.GetSection(TwilioVerifyOptions.SectionName))
			.Validate(x => x.IsSkipEnabled || !string.IsNullOrWhiteSpace(x.AccountSid), "Twilio:AccountSid is required.")
			.Validate(x => x.IsSkipEnabled || !string.IsNullOrWhiteSpace(x.AuthToken), "Twilio:AuthToken is required.")
			.Validate(x => x.IsSkipEnabled || !string.IsNullOrWhiteSpace(x.VerifyServiceSid), "Twilio:VerifyServiceSid is required.")
			.Validate(x => x.IsSkipEnabled || TwilioVerifyOptions.IsValidChannel(x.Channel), "Twilio:Channel must be one of sms, whatsapp, or call.")
			.ValidateOnStart();

		services.AddDbContext<AlifeDbContext>(options =>
			options
				.UseSqlServer(configuration.GetConnectionString("Default"))
				.UseSnakeCaseNamingConvention());
		services.AddScoped<IAlifeDbContext>(sp => sp.GetRequiredService<AlifeDbContext>());

		services.AddScoped<IJwtTokenService, JwtTokenService>();

		var skipRaw = configuration[$"{TwilioVerifyOptions.SectionName}:Skip"];
		var skipVerification = TwilioVerifyOptions.ParseSkip(skipRaw);
		if (skipVerification)
		{
			services.AddScoped<ITwilioVerifyService, StubTwilioVerifyService>();
		}
		else
		{
			services.AddHttpClient<ITwilioVerifyService, TwilioVerifyService>(client =>
			{
				client.BaseAddress = new Uri("https://verify.twilio.com");
				client.Timeout = TimeSpan.FromSeconds(15);
			});
		}
		services.AddHttpClient("youtube", client =>
		{
			client.BaseAddress = new Uri("https://www.googleapis.com/youtube/v3/");
			client.Timeout = TimeSpan.FromSeconds(20);
		});
		services.AddScoped<IYoutubeService, YoutubeService>();
		services.AddScoped<IGroupReadService, GroupReadService>();
		services.AddScoped<IGroupCacheInvalidationService, GroupCacheInvalidationService>();
		services.AddScoped<IGroupAuthorizationService, GroupAuthorizationService>();
		services.AddScoped<IMemberReadService, MemberReadService>();
		services.AddScoped<IPageReadService, PageReadService>();
		services.AddScoped<IPageCacheInvalidationService, PageCacheInvalidationService>();
		services.AddHostedService<SermonSyncHostedService>();

		return services;
	}
}
