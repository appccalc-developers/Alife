using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using System.Text.Json;

namespace Alife.Infrastructure.Persistence;

public static class SeedData
{
	private const string TargetPhoneE164 = "+642102591292";
	private sealed record DemoMemberSeed(
		Guid Id,
		string DisplayName,
		string Sex,
		int Age,
		string Email,
		string PhoneE164,
		bool JoinsServiceTeam);

	public sealed record SeedSummary(
		bool BaselineSeeded,
		string TargetPhoneE164,
		bool TargetMemberFound,
		int TargetMemberPagesFound,
		int SectionsInserted);

	public static async Task<SeedSummary> EnsureSeededAsync(
		AlifeDbContext dbContext,
		IConfiguration? configuration = null,
		CancellationToken cancellationToken = default)
	{
		var baselineSeeded = false;
		var sectionsInserted = 0;

		if (!await dbContext.Groups.AnyAsync(cancellationToken))
		{
			sectionsInserted += await SeedBaselineAsync(dbContext, cancellationToken);
			baselineSeeded = true;
		}

		sectionsInserted += await EnsureDemoDataAsync(dbContext, configuration, cancellationToken);

		var targetMember = await dbContext.Members.FirstOrDefaultAsync(x => x.PhoneE164 == TargetPhoneE164, cancellationToken);
		var targetMemberPagesFound = targetMember is null
			? 0
			: await dbContext.Pages.CountAsync(x => x.CreatedByMemberId == targetMember.Id, cancellationToken);

		return new SeedSummary(
			BaselineSeeded: baselineSeeded,
			TargetPhoneE164: TargetPhoneE164,
			TargetMemberFound: targetMember is not null,
			TargetMemberPagesFound: targetMemberPagesFound,
			SectionsInserted: sectionsInserted);
	}

	private static async Task<int> SeedBaselineAsync(AlifeDbContext dbContext, CancellationToken cancellationToken)
	{
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
			PhoneE164 = TargetPhoneE164,
			PhoneVerifiedUtc = now,
			IsRegistered = true,
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

			pages.Add(new Page
			{
				Id = homePageId,
				OwnerGroupId = group.Id,
				CreatedByMemberId = adminId,
				TitleJson = TextJson("Home", "主页"),
				DescriptionJson = TextJson($"{groupName} home page", $"{groupName} 主页"),
				TagsJson = "[\"home\"]",
				TitleDisplayStyle = "Default",
				Visibility = PageVisibility.Group,
				UpdatedUtc = now
			});

			pages.Add(new Page
			{
				Id = eventsPageId,
				OwnerGroupId = group.Id,
				CreatedByMemberId = adminId,
				TitleJson = TextJson("Events", "活动"),
				DescriptionJson = TextJson($"{groupName} events page", $"{groupName} 活动页"),
				TagsJson = "[\"events\"]",
				TitleDisplayStyle = "Default",
				Visibility = PageVisibility.Group,
				UpdatedUtc = now
			});

			sections.Add(new Section
			{
				Id = Guid.NewGuid(),
				PageId = homePageId,
				Order = 1,
				Type = SectionType.LandingHero,
				ContentJson = JsonSerializer.Serialize(new
				{
					title = new { en = $"{groupName} Home", zh = $"{groupName} 主页" },
					subtitle = new { en = $"Welcome to the {groupName} page.", zh = $"欢迎来到 {groupName} 页面。" },
					backgroundImage = heroImageUrl
				}),
				StyleJson = JsonSerializer.Serialize(new { height = "420px" })
			});

			sections.Add(new Section
			{
				Id = Guid.NewGuid(),
				PageId = eventsPageId,
				Order = 1,
				Type = SectionType.LandingHero,
				ContentJson = JsonSerializer.Serialize(new
				{
					title = new { en = $"{groupName} Events", zh = $"{groupName} 活动" },
					subtitle = new { en = $"See upcoming events for {groupName}.", zh = $"查看 {groupName} 的近期活动。" },
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

		return sections.Count;
	}

	private static async Task<int> EnsureDemoDataAsync(
		AlifeDbContext dbContext,
		IConfiguration? configuration,
		CancellationToken cancellationToken)
	{
		var now = DateTime.UtcNow;
		var sectionsInserted = 0;

		await EnsureFileStorageProvidersAsync(dbContext, configuration, now, cancellationToken);
		await EnsurePlatformRolesAsync(dbContext, cancellationToken);
		await EnsureForumCategoriesAsync(dbContext, now, cancellationToken);

		var admin = await EnsureMemberAsync(
			dbContext,
			Guid.Parse("22222222-2222-2222-2222-222222222222"),
			"Alife Admin",
			"admin@alife.church",
			TargetPhoneE164,
			isAdmin: true,
			now,
			cancellationToken);
		var platformAdmin = await EnsureMemberAsync(
			dbContext,
			Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee0"),
			"Demo Platform Admin",
			"platform-admin@alife.local",
			"+640000000000",
			isAdmin: true,
			now,
			cancellationToken);

		await EnsurePlatformRoleAssignmentAsync(dbContext, admin.Id, PlatformRoleId.SuperAdmin, admin.Id, now, cancellationToken);
		await EnsurePlatformRoleAssignmentAsync(dbContext, platformAdmin.Id, PlatformRoleId.Admin, admin.Id, now, cancellationToken);
		await EnsurePlatformRoleAssignmentAsync(dbContext, platformAdmin.Id, PlatformRoleId.VisitorContactReceiver, admin.Id, now, cancellationToken);

		var church = await dbContext.Groups.FirstOrDefaultAsync(x => x.IsChurch, cancellationToken)
			?? await EnsureGroupAsync(
				dbContext,
				Guid.Parse("11111111-1111-1111-1111-111111111111"),
				"Alife Church",
				"丰盛生命教会",
				null,
				isChurch: true,
				now,
				cancellationToken);

		var fellowship = await EnsureGroupAsync(
			dbContext,
			Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc"),
			"Alpha Fellowship",
			"启发团契",
			church.Id,
			isChurch: false,
			now,
			cancellationToken);

		var serviceTeam = await EnsureGroupAsync(
			dbContext,
			Guid.Parse("dddddddd-dddd-dddd-dddd-dddddddddddd"),
			"Sunday Service Team",
			"主日服事团队",
			church.Id,
			isChurch: false,
			now,
			cancellationToken);

		sectionsInserted += await NzalcAboutPagesSeed.EnsureSeededAsync(
			dbContext,
			church.Id,
			admin.Id,
			now,
			cancellationToken);

		var leader = await EnsureMemberAsync(dbContext, Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee1"), "Demo Leader", "leader@alife.local", "+640000000001", false, now, cancellationToken);
		var coLeader = await EnsureMemberAsync(dbContext, Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee2"), "Demo Co-Leader", "coleader@alife.local", "+640000000002", false, now, cancellationToken);
		var member = await EnsureMemberAsync(dbContext, Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee3"), "Demo Member", "member@alife.local", "+640000000003", false, now, cancellationToken);
		var pending = await EnsureMemberAsync(dbContext, Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeeee4"), "Demo Pending", "pending@alife.local", "+640000000004", false, now, cancellationToken);
		var demoMembers = new[]
		{
			new DemoMemberSeed(Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeee10"), "陈以诺 Evan Chen", "Male", 26, "evan.chen@alife.local", "+640000000010", true),
			new DemoMemberSeed(Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeee11"), "刘子谦 Daniel Liu", "Male", 34, "daniel.liu@alife.local", "+640000000011", false),
			new DemoMemberSeed(Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeee12"), "张伟恩 Nathan Zhang", "Male", 39, "nathan.zhang@alife.local", "+640000000012", true),
			new DemoMemberSeed(Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeee13"), "黄嘉诚 Caleb Huang", "Male", 48, "caleb.huang@alife.local", "+640000000013", false),
			new DemoMemberSeed(Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeee14"), "吴德安 Andrew Wu", "Male", 57, "andrew.wu@alife.local", "+640000000014", true),
			new DemoMemberSeed(Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeee15"), "李恩慈 Grace Li", "Female", 28, "grace.li@alife.local", "+640000000015", false),
			new DemoMemberSeed(Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeee16"), "王思宁 Sophia Wang", "Female", 35, "sophia.wang@alife.local", "+640000000016", true),
			new DemoMemberSeed(Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeee17"), "周明洁 Joy Zhou", "Female", 42, "joy.zhou@alife.local", "+640000000017", false),
			new DemoMemberSeed(Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeee18"), "林悦诗 Esther Lin", "Female", 51, "esther.lin@alife.local", "+640000000018", true),
			new DemoMemberSeed(Guid.Parse("eeeeeeee-eeee-eeee-eeee-eeeeeeeeee19"), "赵雅文 Vivian Zhao", "Female", 63, "vivian.zhao@alife.local", "+640000000019", false)
		};

		foreach (var demoMember in demoMembers)
		{
			var seededMember = await EnsureMemberAsync(
				dbContext,
				demoMember.Id,
				demoMember.DisplayName,
				demoMember.Email,
				demoMember.PhoneE164,
				isAdmin: false,
				now,
				cancellationToken,
				demoMember.Sex,
				demoMember.Age);

			await EnsureMembershipAsync(dbContext, fellowship.Id, seededMember.Id, MembershipStatus.Approved, MembershipRole.Member, now, cancellationToken);
			if (demoMember.JoinsServiceTeam)
			{
				await EnsureMembershipAsync(dbContext, serviceTeam.Id, seededMember.Id, MembershipStatus.Approved, MembershipRole.Member, now, cancellationToken);
			}
		}

		await EnsureMembershipAsync(dbContext, fellowship.Id, admin.Id, MembershipStatus.Approved, MembershipRole.CoLeader, now, cancellationToken);
		await EnsureMembershipAsync(dbContext, fellowship.Id, platformAdmin.Id, MembershipStatus.Approved, MembershipRole.CoLeader, now, cancellationToken);
		await EnsureMembershipAsync(dbContext, fellowship.Id, leader.Id, MembershipStatus.Approved, MembershipRole.Leader, now, cancellationToken);
		await EnsureMembershipAsync(dbContext, fellowship.Id, coLeader.Id, MembershipStatus.Approved, MembershipRole.CoLeader, now, cancellationToken);
		await EnsureMembershipAsync(dbContext, fellowship.Id, member.Id, MembershipStatus.Approved, MembershipRole.Member, now, cancellationToken);
		await EnsureMembershipAsync(dbContext, fellowship.Id, pending.Id, MembershipStatus.Requested, MembershipRole.Member, now, cancellationToken);
		await EnsureMembershipAsync(dbContext, serviceTeam.Id, admin.Id, MembershipStatus.Approved, MembershipRole.CoLeader, now, cancellationToken);
		await EnsureMembershipAsync(dbContext, serviceTeam.Id, platformAdmin.Id, MembershipStatus.Approved, MembershipRole.CoLeader, now, cancellationToken);
		await EnsureMembershipAsync(dbContext, serviceTeam.Id, leader.Id, MembershipStatus.Approved, MembershipRole.Leader, now, cancellationToken);

		sectionsInserted += await EnsureDemoHomePageAsync(dbContext, fellowship.Id, admin.Id, now, cancellationToken);
		sectionsInserted += await EnsureDemoHomePageAsync(dbContext, serviceTeam.Id, admin.Id, now, cancellationToken);

		var picnic = await EnsureEventAsync(
			dbContext,
			Guid.Parse("ffffffff-ffff-ffff-ffff-fffffffffff1"),
			fellowship.Id,
			leader.Id,
			"Community Picnic",
			"社区野餐",
			now.Date.AddDays(7).AddHours(11),
			now.Date.AddDays(7).AddHours(14),
			now,
			cancellationToken);

		var training = await EnsureEventAsync(
			dbContext,
			Guid.Parse("ffffffff-ffff-ffff-ffff-fffffffffff2"),
			serviceTeam.Id,
			leader.Id,
			"Volunteer Training",
			"义工培训",
			now.Date.AddDays(14).AddHours(19),
			now.Date.AddDays(14).AddHours(21),
			now,
			cancellationToken);

		await EnsureEnrollmentAsync(dbContext, fellowship.Id, picnic.Id, member.Id, now, cancellationToken);
		await EnsureEnrollmentAsync(dbContext, serviceTeam.Id, training.Id, coLeader.Id, now, cancellationToken);
		await EnsureNotificationAsync(dbContext, member.Id, leader.Id, fellowship.Id, picnic.Id, "event.invitation", now, cancellationToken);
		await EnsureNotificationAsync(dbContext, leader.Id, pending.Id, fellowship.Id, null, "group.join.requested", now, cancellationToken);

		await dbContext.SaveChangesAsync(cancellationToken);
		return sectionsInserted;
	}

	private static async Task<Member> EnsureMemberAsync(
		AlifeDbContext dbContext,
		Guid id,
		string displayName,
		string email,
		string phoneE164,
		bool isAdmin,
		DateTime now,
		CancellationToken cancellationToken,
		string? sex = null,
		int? age = null)
	{
		var member = await dbContext.Members.FirstOrDefaultAsync(x => x.Id == id, cancellationToken)
			?? await dbContext.Members.FirstOrDefaultAsync(x => x.PhoneE164 == phoneE164, cancellationToken);

		if (member is not null)
		{
			return member;
		}

		member = new Member
		{
			Id = id,
			DisplayName = displayName,
			Sex = sex,
			Age = age,
			Email = email,
			PhoneE164 = phoneE164,
			PhoneVerifiedUtc = now,
			IsRegistered = true,
			CreatedUtc = now,
			UpdatedUtc = now
		};

		await dbContext.Members.AddAsync(member, cancellationToken);
		return member;
	}

	private static async Task EnsurePlatformRolesAsync(AlifeDbContext dbContext, CancellationToken cancellationToken)
	{
		var roles = new[]
		{
			new PlatformRole { Id = (int)PlatformRoleId.User, Code = "user", NameJson = TextJson("User", "普通用户"), PermissionsJson = PermissionsJson("user"), Level = 0 },
			new PlatformRole { Id = (int)PlatformRoleId.PageReviewer, Code = "page_reviewer", NameJson = TextJson("Page Reviewer", "发布审核者"), PermissionsJson = PermissionsJson("page_reviewer"), Level = 5 },
			new PlatformRole { Id = (int)PlatformRoleId.VisitorContactReceiver, Code = "visitor_contact_receiver", NameJson = TextJson("Visitor Contact Receiver", "访客联系接待"), PermissionsJson = PermissionsJson("visitor_contact_receiver"), Level = 6 },
			new PlatformRole { Id = (int)PlatformRoleId.Admin, Code = "admin", NameJson = TextJson("Admin", "联合管理员"), PermissionsJson = PermissionsJson("admin"), Level = 10 },
			new PlatformRole { Id = (int)PlatformRoleId.SuperAdmin, Code = "superadmin", NameJson = TextJson("System Admin", "系统管理员"), PermissionsJson = PermissionsJson("superadmin"), Level = 100 }
		};

		foreach (var role in roles)
		{
			var existing = await dbContext.PlatformRoles.FirstOrDefaultAsync(
				x => x.Id == role.Id || x.Code == role.Code,
				cancellationToken);
			if (existing is not null)
			{
				existing.Code = role.Code;
				existing.NameJson = role.NameJson;
				if (string.IsNullOrWhiteSpace(existing.PermissionsJson))
				{
					existing.PermissionsJson = role.PermissionsJson;
				}
				else if (role.Code is "admin" or "superadmin" or "page_reviewer" or "visitor_contact_receiver")
				{
					existing.PermissionsJson = MergePermissionsJson(existing.Code, existing.PermissionsJson, role.PermissionsJson);
				}
				existing.Level = role.Level;
				continue;
			}

			await dbContext.PlatformRoles.AddAsync(role, cancellationToken);
		}
	}

	private static async Task EnsureForumCategoriesAsync(
		AlifeDbContext dbContext,
		DateTime now,
		CancellationToken cancellationToken)
	{
		var categories = new[]
		{
			new ForumCategory { Id = Guid.Parse("f0f00000-0000-4000-8000-000000000001"), NameJson = TextJson("Announcements", "公告"), DescriptionJson = TextJson("Official community updates.", "社区官方更新。"), SortOrder = 10 },
			new ForumCategory { Id = Guid.Parse("f0f00000-0000-4000-8000-000000000002"), NameJson = TextJson("Testimonies", "见证"), DescriptionJson = TextJson("Share stories of faith and life.", "分享信仰与生活见证。"), SortOrder = 20 },
			new ForumCategory { Id = Guid.Parse("f0f00000-0000-4000-8000-000000000003"), NameJson = TextJson("Q&A", "问答"), DescriptionJson = TextJson("Ask questions and help each other.", "提问并彼此帮助。"), SortOrder = 30 },
			new ForumCategory { Id = Guid.Parse("f0f00000-0000-4000-8000-000000000005"), NameJson = TextJson("Event Sharing", "活动分享"), DescriptionJson = TextJson("Reflections and photos from community events.", "分享活动心得与照片。"), SortOrder = 40 },
			new ForumCategory { Id = Guid.Parse("f0f00000-0000-4000-8000-000000000006"), NameJson = TextJson("Resources", "资源"), DescriptionJson = TextJson("Books, links, sermons, and learning resources.", "书籍、链接、讲道与学习资源。"), SortOrder = 50 },
			new ForumCategory { Id = Guid.Parse("f0f00000-0000-4000-8000-000000000007"), NameJson = TextJson("General", "综合"), DescriptionJson = TextJson("General community discussion.", "综合社区讨论。"), SortOrder = 60 }
		};

		foreach (var category in categories)
		{
			var existing = await dbContext.ForumCategories.FirstOrDefaultAsync(x => x.Id == category.Id, cancellationToken);
			if (existing is null)
			{
				category.IsEnabled = true;
				category.CreatedUtc = now;
				category.UpdatedUtc = now;
				await dbContext.ForumCategories.AddAsync(category, cancellationToken);
				continue;
			}

			existing.NameJson = category.NameJson;
			existing.DescriptionJson = category.DescriptionJson;
			existing.SortOrder = category.SortOrder;
			existing.IsEnabled = true;
			existing.UpdatedUtc = now;
		}
	}

	private static string PermissionsJson(string roleCode)
		=> System.Text.Json.JsonSerializer.Serialize(Alife.Application.Admin.AdminPermissionCatalog.GetDefaultPermissions(roleCode));

	private static string MergePermissionsJson(string roleCode, string currentJson, string defaultJson)
	{
		IEnumerable<string> current;
		IEnumerable<string> defaults;
		try
		{
			current = System.Text.Json.JsonSerializer.Deserialize<string[]>(currentJson) ?? [];
			defaults = System.Text.Json.JsonSerializer.Deserialize<string[]>(defaultJson) ?? [];
		}
		catch (System.Text.Json.JsonException)
		{
			return PermissionsJson(roleCode);
		}

		return Alife.Application.Admin.AdminPermissionCatalog.WritePermissions(current.Concat(defaults));
	}

	private static async Task EnsureFileStorageProvidersAsync(
		AlifeDbContext dbContext,
		IConfiguration? configuration,
		DateTime now,
		CancellationToken cancellationToken)
	{
		var providerCode = ReadConfig(configuration, "FileAssets:ProviderCode", "local-dev");
		var isCloudflareR2 = providerCode.Equals("cloudflare-r2", StringComparison.OrdinalIgnoreCase);
		var providerId = isCloudflareR2
			? Guid.Parse("f1111111-1111-4111-8111-111111111111")
			: Guid.Parse("f2222222-2222-4222-8222-222222222222");
		var kind = isCloudflareR2 ? FileStorageProviderKind.CloudflareR2 : FileStorageProviderKind.LocalDev;
		var bucketName = ReadConfig(configuration, "FileAssets:BucketName", isCloudflareR2 ? "ccalc" : "local-dev");
		var baseUrl = ReadConfig(
			configuration,
			"FileAssets:ImageApiBaseUrl",
			isCloudflareR2 ? "https://images.ccalc.live" : "http://localhost:8787");
		var privateBaseUrl = ReadConfig(configuration, "FileAssets:PrivateFileBaseUrl", baseUrl);
		var uploadApiBaseUrl = ReadConfig(configuration, "FileAssets:UploadApiBaseUrl", baseUrl);
		var privatePathPrefix = ReadConfig(configuration, "FileAssets:PrivatePathPrefix", "private");
		var provider = await dbContext.FileStorageProviders.FirstOrDefaultAsync(x => x.Code == providerCode, cancellationToken);
		if (provider is null)
		{
			provider = new FileStorageProvider
			{
				Id = providerId,
				Code = providerCode,
				CreatedUtc = now,
			};
			await dbContext.FileStorageProviders.AddAsync(provider, cancellationToken);
		}

		provider.Kind = kind;
		provider.DisplayNameJson = isCloudflareR2
			? TextJson("Cloudflare R2 image storage", "Cloudflare R2 图片存储")
			: TextJson("Local development file storage", "本地开发文件存储");
		provider.IsActive = true;
		provider.IsDefault = true;
		provider.BucketName = bucketName;
		provider.PublicBaseUrl = baseUrl;
		provider.PrivateBaseUrl = privateBaseUrl;
		provider.UploadApiBaseUrl = uploadApiBaseUrl;
		provider.PublicPathPrefix = string.Empty;
		provider.PrivatePathPrefix = privatePathPrefix;
		provider.SupportsPublicUrl = true;
		provider.SupportsSignedRead = true;
		provider.SupportsServerSideMove = isCloudflareR2;
		provider.UpdatedUtc = now;

		var otherProviders = await dbContext.FileStorageProviders
			.Where(x => x.Code != providerCode)
			.ToListAsync(cancellationToken);
		foreach (var otherProvider in otherProviders)
		{
			otherProvider.IsDefault = false;
			if (!isCloudflareR2 && otherProvider.Code == "cloudflare-r2")
			{
				otherProvider.IsActive = false;
			}
			otherProvider.UpdatedUtc = now;
		}
	}

	private static string ReadConfig(IConfiguration? configuration, string key, string fallback)
	{
		var value = configuration?[key];
		return string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
	}

	private static async Task EnsurePlatformRoleAssignmentAsync(
		AlifeDbContext dbContext,
		Guid memberId,
		PlatformRoleId roleId,
		Guid? assignedByMemberId,
		DateTime now,
		CancellationToken cancellationToken)
	{
		if (await dbContext.MemberPlatformRoles.AnyAsync(
			    x => x.MemberId == memberId && x.RoleId == (int)roleId && x.RevokedUtc == null,
			    cancellationToken))
		{
			return;
		}

		await dbContext.MemberPlatformRoles.AddAsync(new MemberPlatformRole
		{
			Id = Guid.NewGuid(),
			MemberId = memberId,
			RoleId = (int)roleId,
			AssignedByMemberId = assignedByMemberId,
			AssignedUtc = now
		}, cancellationToken);
	}

	private static async Task<Group> EnsureGroupAsync(
		AlifeDbContext dbContext,
		Guid id,
		string nameEn,
		string nameZh,
		Guid? parentGroupId,
		bool isChurch,
		DateTime now,
		CancellationToken cancellationToken)
	{
		var group = await dbContext.Groups.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
		if (group is not null)
		{
			return group;
		}

		group = new Group
		{
			Id = id,
			NameJson = TextJson(nameEn, nameZh),
			DescriptionJson = TextJson($"{nameEn} demo workspace.", $"{nameZh} 演示工作区。"),
			ParentGroupId = parentGroupId,
			AccessType = AccessType.Protected,
			IsChurch = isChurch,
			IsClosed = false,
			CreatedUtc = now,
			UpdatedUtc = now
		};

		await dbContext.Groups.AddAsync(group, cancellationToken);
		return group;
	}

	private static async Task EnsureMembershipAsync(
		AlifeDbContext dbContext,
		Guid groupId,
		Guid memberId,
		MembershipStatus status,
		MembershipRole role,
		DateTime now,
		CancellationToken cancellationToken)
	{
		var membership = await dbContext.GroupMemberships.FirstOrDefaultAsync(
			x => x.GroupId == groupId && x.MemberId == memberId && x.Status == status,
			cancellationToken);

		if (membership is not null)
		{
			return;
		}

		await dbContext.GroupMemberships.AddAsync(new GroupMembership
		{
			Id = Guid.NewGuid(),
			GroupId = groupId,
			MemberId = memberId,
			Status = status,
			Role = role,
			CreatedUtc = now,
			UpdatedUtc = now
		}, cancellationToken);
	}

	private static async Task<int> EnsureDemoHomePageAsync(
		AlifeDbContext dbContext,
		Guid groupId,
		Guid adminId,
		DateTime now,
		CancellationToken cancellationToken)
	{
		var pageId = DeterministicGuid(groupId, "demo-home-page");
		if (await dbContext.Pages.AnyAsync(x => x.Id == pageId, cancellationToken))
		{
			return 0;
		}

		await dbContext.Pages.AddAsync(new Page
		{
			Id = pageId,
			OwnerGroupId = groupId,
			CreatedByMemberId = adminId,
			TitleJson = TextJson("Demo Home", "演示主页"),
			DescriptionJson = TextJson("Seeded demo page for local testing.", "用于本地测试的演示页面。"),
			TagsJson = "[\"demo\",\"home\"]",
			TitleDisplayStyle = "Default",
			Visibility = PageVisibility.Group,
			UpdatedUtc = now
		}, cancellationToken);

		await dbContext.Sections.AddRangeAsync(new[]
		{
			new Section
			{
				Id = DeterministicGuid(pageId, "hero"),
				PageId = pageId,
				Order = 1,
				Type = SectionType.LandingHero,
				ContentJson = JsonSerializer.Serialize(new
				{
					title = new { en = "Welcome to this demo group", zh = "欢迎来到演示小组" },
					subtitle = new { en = "This content is inserted by DbMigrator for local testing.", zh = "这些内容由 DbMigrator 插入，用于本地测试。" },
					backgroundImage = "https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1600&q=80"
				}),
				StyleJson = JsonSerializer.Serialize(new { layout = "featured", aspectRatio = 1.777 })
			},
			new Section
			{
				Id = DeterministicGuid(pageId, "text"),
				PageId = pageId,
				Order = 2,
				Type = SectionType.RichText,
				ContentJson = JsonSerializer.Serialize(new
				{
					title = new { en = "Leader notes", zh = "组长备注" },
					text = new { en = "Use this group to test members, events, pages, and notifications.", zh = "你可以用这个小组测试成员、活动、页面和通知。" }
				}),
				StyleJson = "{}"
			}
		}, cancellationToken);

		return 2;
	}

	private static async Task<GroupEvent> EnsureEventAsync(
		AlifeDbContext dbContext,
		Guid id,
		Guid groupId,
		Guid createdByMemberId,
		string titleEn,
		string titleZh,
		DateTime startDate,
		DateTime endDate,
		DateTime now,
		CancellationToken cancellationToken)
	{
		var groupEvent = await dbContext.GroupEvents.FirstOrDefaultAsync(x => x.Id == id, cancellationToken);
		if (groupEvent is not null)
		{
			return groupEvent;
		}

		groupEvent = new GroupEvent
		{
			Id = id,
			GroupId = groupId,
			CreatedByMemberId = createdByMemberId,
			TitleEn = titleEn,
			TitleZh = titleZh,
			StartDate = startDate,
			EndDate = endDate,
			EventDataJson = JsonSerializer.Serialize(new
			{
				title = new { en = titleEn, zh = titleZh },
				location = new { en = "Church Hall", zh = "教会大厅" },
				description = new { en = "Seeded local demo event.", zh = "本地演示活动。" }
			}),
			CreatedUtc = now,
			UpdatedUtc = now,
			IsDeleted = false
		};

		await dbContext.GroupEvents.AddAsync(groupEvent, cancellationToken);
		return groupEvent;
	}

	private static async Task EnsureEnrollmentAsync(
		AlifeDbContext dbContext,
		Guid groupId,
		Guid eventId,
		Guid memberId,
		DateTime now,
		CancellationToken cancellationToken)
	{
		if (await dbContext.EventEnrollments.AnyAsync(x => x.EventId == eventId && x.MemberId == memberId, cancellationToken))
		{
			return;
		}

		await dbContext.EventEnrollments.AddAsync(new EventEnrollment
		{
			Id = Guid.NewGuid(),
			GroupId = groupId,
			EventId = eventId,
			MemberId = memberId,
			EnrollmentJson = JsonSerializer.Serialize(new { status = "confirmed", note = "Seeded demo enrollment" }),
			CreatedUtc = now,
			UpdatedUtc = now
		}, cancellationToken);
	}

	private static async Task EnsureNotificationAsync(
		AlifeDbContext dbContext,
		Guid recipientMemberId,
		Guid createdByMemberId,
		Guid? groupId,
		Guid? eventId,
		string actionType,
		DateTime now,
		CancellationToken cancellationToken)
	{
		var notificationId = DeterministicGuid(recipientMemberId, $"{actionType}:{groupId}:{eventId}");
		if (await dbContext.NotificationMessages.AnyAsync(x => x.Id == notificationId, cancellationToken))
		{
			return;
		}

		await dbContext.NotificationMessages.AddAsync(new NotificationMessage
		{
			Id = notificationId,
			RecipientMemberId = recipientMemberId,
			CreatedByMemberId = createdByMemberId,
			GroupId = groupId,
			EventId = eventId,
			OccurredUtc = now,
			ActionType = actionType,
			ActionDataJson = JsonSerializer.Serialize(new { seeded = true, source = "DbMigrator" }),
			CreatedUtc = now,
			UpdatedUtc = now
		}, cancellationToken);
	}

	private static string TextJson(string en, string zh)
		=> JsonSerializer.Serialize(new Dictionary<string, string> { ["en"] = en, ["zh"] = zh });

	private static string ReadText(string json)
	{
		var value = JsonSerializer.Deserialize<Dictionary<string, string>>(json) ?? [];
		return value.GetValueOrDefault("en") ?? value.GetValueOrDefault("zh") ?? value.Values.FirstOrDefault() ?? string.Empty;
	}

	private static Guid DeterministicGuid(Guid id, string salt)
	{
		var bytes = System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes($"{id:N}:{salt}"));
		return new Guid(bytes[..16]);
	}
}
