using Alife.Application.Abstractions.Integrations;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Alife.Infrastructure.Integrations;

public class YoutubeService(AlifeDbContext dbContext, ILogger<YoutubeService> logger) : IYoutubeService
{
	public async Task SyncSermonsAsync(CancellationToken cancellationToken = default)
	{
		var sections = await dbContext.Sections
			.Where(x => x.Type == SectionType.SermonList)
			.ToListAsync(cancellationToken);

		foreach (var section in sections)
		{
			logger.LogInformation("Sermon sync stub for section {SectionId} with payload {Payload}", section.Id, section.ContentJson);
		}
	}
}