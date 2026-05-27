using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Alife.Infrastructure.Persistence;

public static class SeedData
{
	public sealed record SeedSummary(
		bool BaselineSeeded,
		string TargetPhoneE164,
		bool TargetMemberFound,
		int TargetMemberPagesFound,
		int SectionsInserted);

	public static async Task<SeedSummary> EnsureSeededAsync(AlifeDbContext dbContext, CancellationToken cancellationToken = default)
	{
		var hasAnyGroup = await dbContext.Groups.AnyAsync(cancellationToken);
		if (hasAnyGroup)
		{
			return new SeedSummary(
				BaselineSeeded: false,
				TargetPhoneE164: "+642102591292",
				TargetMemberFound: await dbContext.Members.AnyAsync(x => x.PhoneE164 == "+642102591292", cancellationToken),
				TargetMemberPagesFound: 0,
				SectionsInserted: 0);
		}

		var now = DateTime.UtcNow;
		var adminId = Guid.Parse("22222222-2222-2222-2222-222222222222");

		var churchId = Guid.Parse("11111111-1111-1111-1111-111111111111");
		var youthId = Guid.Parse("33333333-3333-3333-3333-333333333333");
		var youngAdultsId = Guid.Parse("99999999-9999-9999-9999-999999999999");
		var worshipId = Guid.Parse("44444444-4444-4444-4444-444444444444");
		var prayerId = Guid.Parse("77777777-7777-7777-7777-777777777777");
		var kidsId = Guid.Parse("88888888-8888-8888-8888-888888888888");
		var smallGroupCentralId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
		var smallGroupWestId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");

		var groups = new[]
		{
			new Group { Id = churchId, NameJson = TextJson("Alife Church", "丰盛生命教会"), DescriptionJson = TextJson("Church-wide group workspace.", "教会整体小组工作区。"), AccessType = AccessType.Protected, IsChurch = true, IsClosed = false, CreatedUtc = now, UpdatedUtc = now },
			new Group { Id = youthId, NameJson = TextJson("Youth Group (13-18)", "青少年小组（13-18）"), DescriptionJson = TextJson("For youth ministry members.", "青少年事工成员小组。"), ParentGroupId = churchId, AccessType = AccessType.Protected, IsChurch = false, IsClosed = false, CreatedUtc = now, UpdatedUtc = now },
			new Group { Id = youngAdultsId, NameJson = TextJson("Young Adults (19-30)", "青年小组（19-30）"), DescriptionJson = TextJson("For young adults and students.", "青年与学生小组。"), ParentGroupId = churchId, AccessType = AccessType.Protected, IsChurch = false, IsClosed = false, CreatedUtc = now, UpdatedUtc = now },
			new Group { Id = worshipId, NameJson = TextJson("Worship Team", "敬拜团队"), DescriptionJson = TextJson("Worship team planning and updates.", "敬拜团队计划与更新。"), ParentGroupId = churchId, AccessType = AccessType.Protected, IsChurch = false, IsClosed = false, CreatedUtc = now, UpdatedUtc = now },
			new Group { Id = prayerId, NameJson = TextJson("Prayer Ministry", "祷告事工"), DescriptionJson = TextJson("Prayer ministry coordination.", "祷告事工协调。"), ParentGroupId = churchId, AccessType = AccessType.Protected, IsChurch = false, IsClosed = false, CreatedUtc = now, UpdatedUtc = now },
			new Group { Id = kidsId, NameJson = TextJson("Kids Ministry (5-12)", "儿童事工（5-12）"), DescriptionJson = TextJson("Kids ministry team workspace.", "儿童事工团队工作区。"), ParentGroupId = churchId, AccessType = AccessType.Protected, IsChurch = false, IsClosed = false, CreatedUtc = now, UpdatedUtc = now },
			new Group { Id = smallGroupCentralId, NameJson = TextJson("Small Group - Central District", "中区小组"), DescriptionJson = TextJson("Central district small group.", "中区小组。"), ParentGroupId = churchId, AccessType = AccessType.Protected, IsChurch = false, IsClosed = false, CreatedUtc = now, UpdatedUtc = now },
			new Group { Id = smallGroupWestId, NameJson = TextJson("Small Group - West Side", "西区小组"), DescriptionJson = TextJson("West side small group.", "西区小组。"), ParentGroupId = churchId, AccessType = AccessType.Protected, IsChurch = false, IsClosed = false, CreatedUtc = now, UpdatedUtc = now }
		};

		var groupHeroImages = new Dictionary<Guid, string>
		{
			[churchId] = "https://images.unsplash.com/photo-1438232992991-995b7058bbb3?auto=format&fit=crop&w=1600&q=80",
			[youthId] = "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1600&q=80",
			[youngAdultsId] = "https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1600&q=80",
			[worshipId] = "https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=1600&q=80",
			[prayerId] = "https://images.unsplash.com/photo-1504052434569-70ad5836ab65?auto=format&fit=crop&w=1600&q=80",
			[kidsId] = "https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?auto=format&fit=crop&w=1600&q=80",
			[smallGroupCentralId] = "https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1600&q=80",
			[smallGroupWestId] = "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1600&q=80"
		};

		var admin = new Member
		{
			Id = adminId,
			DisplayName = "Alife Admin",
			Sex = "Male",
			Age = 45,
			Email = "admin@alife.church",
			PhoneE164 = "+642102591292",
			PhoneVerifiedUtc = now,
			IsRegistered = true,
			IsAdmin = true,
			CreatedUtc = now,
			UpdatedUtc = now
		};

		var memberships = groups.Select(group => new GroupMembership
		{
			Id = Guid.NewGuid(),
			GroupId = group.Id,
			MemberId = adminId,
			Status = MembershipStatus.Approved,
			Role = MembershipRole.CoLeader,
			CreatedUtc = now,
			UpdatedUtc = now
		}).ToList();

		var pages = new List<Page>();
		var sections = new List<Section>();

		foreach (var group in groups)
		{
			var groupName = ReadText(group.NameJson);
			var heroImageUrl = groupHeroImages[group.Id];
			var homePageId = Guid.NewGuid();
			var eventsPageId = Guid.NewGuid();

			var homePage = new Page
			{
				Id = homePageId,
				Scope = PageScope.Group,
				OwnerGroupId = group.Id,
				CreatedByMemberId = adminId,
				TitleJson = JsonSerializer.Serialize(new Dictionary<string, string> { ["en"] = "Home", ["cn"] = "主页" }),
				DescriptionJson = JsonSerializer.Serialize(new Dictionary<string, string> { ["en"] = $"{groupName} home page", ["cn"] = $"{groupName} 主页" }),
				TagsJson = "[\"home\"]",
				TitleDisplayStyle = "Default",
				Visibility = PageVisibility.Group,
				UpdatedUtc = now
			};

			var eventsPage = new Page
			{
				Id = eventsPageId,
				Scope = PageScope.Group,
				OwnerGroupId = group.Id,
				CreatedByMemberId = adminId,
				TitleJson = JsonSerializer.Serialize(new Dictionary<string, string> { ["en"] = "Events", ["cn"] = "活动" }),
				DescriptionJson = JsonSerializer.Serialize(new Dictionary<string, string> { ["en"] = $"{groupName} events page", ["cn"] = $"{groupName} 活动页" }),
				TagsJson = "[\"events\"]",
				TitleDisplayStyle = "Default",
				Visibility = PageVisibility.Group,
				UpdatedUtc = now
			};

			pages.Add(homePage);
			pages.Add(eventsPage);

			sections.Add(new Section
			{
				Id = Guid.NewGuid(),
				PageId = homePageId,
				Order = 1,
				Type = SectionType.Hero,
				ContentJson = JsonSerializer.Serialize(new
				{
					title = new { en = $"{groupName} Home", cn = $"{groupName} 主页" },
					subtitle = new { en = $"Welcome to the {groupName} page.", cn = $"欢迎来到 {groupName} 页面。" },
					backgroundImage = heroImageUrl
				}),
				StyleJson = JsonSerializer.Serialize(new { height = "420px" })
			});

			sections.Add(new Section
			{
				Id = Guid.NewGuid(),
				PageId = eventsPageId,
				Order = 1,
				Type = SectionType.Hero,
				ContentJson = JsonSerializer.Serialize(new
				{
					title = new { en = $"{groupName} Events", cn = $"{groupName} 活动" },
					subtitle = new { en = $"See upcoming events for {groupName}.", cn = $"查看 {groupName} 的近期活动。" },
					backgroundImage = heroImageUrl
				}),
				StyleJson = JsonSerializer.Serialize(new { height = "420px" })
			});
		}

		await dbContext.Groups.AddRangeAsync(groups, cancellationToken);
		await dbContext.Members.AddAsync(admin, cancellationToken);
		await dbContext.GroupMemberships.AddRangeAsync(memberships, cancellationToken);
		await dbContext.Pages.AddRangeAsync(pages, cancellationToken);
		await dbContext.Sections.AddRangeAsync(sections, cancellationToken);
		await dbContext.SaveChangesAsync(cancellationToken);

		return new SeedSummary(
			BaselineSeeded: true,
			TargetPhoneE164: "+642102591292",
			TargetMemberFound: true,
			TargetMemberPagesFound: pages.Count,
			SectionsInserted: sections.Count);
	}

	private static string TextJson(string en, string cn)
		=> JsonSerializer.Serialize(new Dictionary<string, string> { ["en"] = en, ["cn"] = cn });

	private static string ReadText(string json)
	{
		var value = JsonSerializer.Deserialize<Dictionary<string, string>>(json) ?? [];
		return value.GetValueOrDefault("en") ?? value.GetValueOrDefault("cn") ?? value.Values.FirstOrDefault() ?? string.Empty;
	}
}
