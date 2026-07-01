using Alife.Application.Common.Models;
using Alife.Application.Admin.Commands.BackfillMemberPrivateFiles;
using Alife.Application.FileAssets.Commands.RegisterFileAsset;
using Alife.Application.FileAssets.Queries.GetFileAssetOpenUrl;
using Alife.Application.FileAssets.Queries.ListFileAssets;
using Alife.Application.FileAssets.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace Alife.Tests.Unit.FileAssets;

public class RegisterFileAssetCommandHandlerTests
{
    [Fact]
    public async Task List_LeaderCanFilterGroupFiles()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupId = Guid.NewGuid();
        var otherGroupId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        dbContext.Groups.Add(CreateGroup(groupId));
        dbContext.Groups.Add(CreateGroup(otherGroupId));
        dbContext.FileAssets.Add(CreateFileAsset(groupId, FileAssetVisibility.GroupVisible, FileAssetPurpose.EventPoster, "event", eventId, DateTime.UtcNow.AddMinutes(-1)));
        dbContext.FileAssets.Add(CreateFileAsset(groupId, FileAssetVisibility.MemberPrivate, FileAssetPurpose.EnrollmentPaymentProof, "enrollment", Guid.NewGuid(), DateTime.UtcNow));
        dbContext.FileAssets.Add(CreateFileAsset(otherGroupId, FileAssetVisibility.GroupVisible, FileAssetPurpose.EventPoster, "event", Guid.NewGuid(), DateTime.UtcNow));
        await dbContext.SaveChangesAsync();

        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService
            .IsLeaderOrCoLeaderAsync(groupId, memberId, Arg.Any<CancellationToken>())
            .Returns(true);
        var handler = new ListFileAssetsQueryHandler(dbContext, authorizationService);

        var result = await handler.Handle(
            new ListFileAssetsQuery(
                memberId,
                groupId,
                FileAssetVisibility.GroupVisible,
                FileAssetPurpose.EventPoster,
                "event",
                eventId,
                false,
                1,
                25,
                FileAssetSortBy.UploadedUtc,
                SortDirection.Desc),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(1, result.Value!.TotalCount);
        var file = Assert.Single(result.Value.Items);
        Assert.Equal(groupId, file.GroupId);
        Assert.Equal(FileAssetVisibility.GroupVisible, file.Visibility);
        Assert.Equal(FileAssetPurpose.EventPoster, file.Purpose);
        Assert.Equal(eventId, file.RelatedEntityId);
    }

    [Fact]
    public async Task List_RejectsGroupFilesForNonLeader()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        dbContext.Groups.Add(CreateGroup(groupId));
        dbContext.FileAssets.Add(CreateFileAsset(groupId, FileAssetVisibility.GroupVisible, FileAssetPurpose.ReviewPhoto, "review", Guid.NewGuid(), DateTime.UtcNow));
        await dbContext.SaveChangesAsync();

        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService
            .IsLeaderOrCoLeaderAsync(groupId, memberId, Arg.Any<CancellationToken>())
            .Returns(false);
        var handler = new ListFileAssetsQueryHandler(dbContext, authorizationService);

        var result = await handler.Handle(
            new ListFileAssetsQuery(
                memberId,
                groupId,
                null,
                null,
                null,
                null,
                false,
                1,
                25,
                FileAssetSortBy.UploadedUtc,
                SortDirection.Desc),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(AppResultStatus.Forbidden, result.Status);
    }

    [Fact]
    public async Task List_PaginatesAndHidesPrivatePublicUrl()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        dbContext.Groups.Add(CreateGroup(groupId));
        dbContext.FileAssets.Add(CreateFileAsset(groupId, FileAssetVisibility.GroupVisible, FileAssetPurpose.ReviewPhoto, "review", Guid.NewGuid(), DateTime.UtcNow.AddMinutes(-2)));
        dbContext.FileAssets.Add(CreateFileAsset(groupId, FileAssetVisibility.MemberPrivate, FileAssetPurpose.EnrollmentPaymentProof, "enrollment", Guid.NewGuid(), DateTime.UtcNow.AddMinutes(-1)));
        dbContext.FileAssets.Add(CreateFileAsset(groupId, FileAssetVisibility.GroupVisible, FileAssetPurpose.EventPoster, "event", Guid.NewGuid(), DateTime.UtcNow));
        await dbContext.SaveChangesAsync();

        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService
            .IsLeaderOrCoLeaderAsync(groupId, memberId, Arg.Any<CancellationToken>())
            .Returns(true);
        var handler = new ListFileAssetsQueryHandler(dbContext, authorizationService);

        var result = await handler.Handle(
            new ListFileAssetsQuery(
                memberId,
                groupId,
                null,
                null,
                null,
                null,
                false,
                1,
                2,
                FileAssetSortBy.UploadedUtc,
                SortDirection.Desc),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(3, result.Value!.TotalCount);
        Assert.Equal(2, result.Value.Items.Count);
        Assert.All(result.Value.Items, file => Assert.NotNull(file.AccessUrl));
        Assert.DoesNotContain(result.Value.Items, file => file.Visibility == FileAssetVisibility.MemberPrivate && file.PublicUrl is not null);
    }

    [Fact]
    public async Task List_AdminCanFilterUnassignedFiles()
    {
        using var dbContext = CreateInMemoryDbContext();
        var adminId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        dbContext.Groups.Add(CreateGroup(groupId));
        AddSuperAdmin(dbContext, adminId);
        dbContext.FileAssets.Add(CreateFileAsset(null, FileAssetVisibility.Public, FileAssetPurpose.General, "member", Guid.NewGuid(), DateTime.UtcNow));
        dbContext.FileAssets.Add(CreateFileAsset(groupId, FileAssetVisibility.Public, FileAssetPurpose.EventPoster, "event", Guid.NewGuid(), DateTime.UtcNow));
        await dbContext.SaveChangesAsync();

        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService
            .IsAdminAsync(adminId, Arg.Any<CancellationToken>())
            .Returns(true);
        var handler = new ListFileAssetsQueryHandler(dbContext, authorizationService);

        var result = await handler.Handle(
            new ListFileAssetsQuery(
                adminId,
                null,
                null,
                null,
                null,
                null,
                true,
                1,
                25,
                FileAssetSortBy.UploadedUtc,
                SortDirection.Desc),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        var file = Assert.Single(result.Value!.Items);
        Assert.Null(file.GroupId);
    }

    [Fact]
    public async Task Open_PrivateFileAllowsGroupLeaderAfterAuthorization()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupId = Guid.NewGuid();
        var leaderId = Guid.NewGuid();
        var file = CreateFileAsset(groupId, FileAssetVisibility.MemberPrivate, FileAssetPurpose.EnrollmentPaymentProof, "enrollment", Guid.NewGuid(), DateTime.UtcNow);
        dbContext.Groups.Add(CreateGroup(groupId));
        dbContext.FileAssets.Add(file);
        await dbContext.SaveChangesAsync();

        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService
            .IsAdminAsync(leaderId, Arg.Any<CancellationToken>())
            .Returns(false);
        authorizationService
            .IsLeaderOrCoLeaderAsync(groupId, leaderId, Arg.Any<CancellationToken>())
            .Returns(true);
        var signer = Substitute.For<IFileAssetAccessUrlSigner>();
        signer
            .CreatePrivateReadUrlAsync(file.StorageProvider, file.ObjectKey, Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>())
            .Returns("https://images.ccalc.live/api/private-files/signed?exp=1&sig=test");
        var handler = new GetFileAssetOpenUrlQueryHandler(dbContext, authorizationService, signer);

        var result = await handler.Handle(new GetFileAssetOpenUrlQuery(leaderId, file.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("https://images.ccalc.live/api/private-files/signed?exp=1&sig=test", result.Value);
    }

    [Fact]
    public async Task Open_PrivateFileRejectsUnauthorizedMember()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var file = CreateFileAsset(groupId, FileAssetVisibility.MemberPrivate, FileAssetPurpose.EnrollmentPaymentProof, "enrollment", Guid.NewGuid(), DateTime.UtcNow);
        dbContext.Groups.Add(CreateGroup(groupId));
        dbContext.FileAssets.Add(file);
        await dbContext.SaveChangesAsync();

        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService
            .IsAdminAsync(memberId, Arg.Any<CancellationToken>())
            .Returns(false);
        authorizationService
            .IsLeaderOrCoLeaderAsync(groupId, memberId, Arg.Any<CancellationToken>())
            .Returns(false);
        var signer = Substitute.For<IFileAssetAccessUrlSigner>();
        var handler = new GetFileAssetOpenUrlQueryHandler(dbContext, authorizationService, signer);

        var result = await handler.Handle(new GetFileAssetOpenUrlQuery(memberId, file.Id), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(AppResultStatus.Forbidden, result.Status);
        _ = signer.DidNotReceive().CreatePrivateReadUrlAsync(Arg.Any<string>(), Arg.Any<string>(), Arg.Any<TimeSpan>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task EventPoster_RequiresLeaderOrCoLeader()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        dbContext.Groups.Add(CreateGroup(groupId));
        dbContext.GroupEvents.Add(CreateEvent(eventId, groupId, memberId));
        await dbContext.SaveChangesAsync();

        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService
            .IsLeaderOrCoLeaderAsync(groupId, memberId, Arg.Any<CancellationToken>())
            .Returns(false);
        var handler = new RegisterFileAssetCommandHandler(dbContext, authorizationService, CreateProviderResolver());

        var result = await handler.Handle(
            CreateCommand(
                memberId,
                groupId,
                FileAssetVisibility.GroupVisible,
                FileAssetPurpose.EventPoster,
                "event",
                eventId),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(AppResultStatus.Forbidden, result.Status);
        Assert.Empty(dbContext.FileAssets);
    }

    [Fact]
    public async Task EventPoster_RegistersForLeader()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupId = Guid.NewGuid();
        var eventId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        dbContext.Groups.Add(CreateGroup(groupId));
        dbContext.GroupEvents.Add(CreateEvent(eventId, groupId, memberId));
        await dbContext.SaveChangesAsync();

        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService
            .IsLeaderOrCoLeaderAsync(groupId, memberId, Arg.Any<CancellationToken>())
            .Returns(true);
        var handler = new RegisterFileAssetCommandHandler(dbContext, authorizationService, CreateProviderResolver());

        var result = await handler.Handle(
            CreateCommand(
                memberId,
                groupId,
                FileAssetVisibility.GroupVisible,
                FileAssetPurpose.EventPoster,
                "event",
                eventId),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(FileAssetPurpose.EventPoster, result.Value?.Purpose);
        Assert.Equal(FileAssetVisibility.GroupVisible, result.Value?.Visibility);
        Assert.Equal(eventId, result.Value?.RelatedEntityId);
        Assert.Single(dbContext.FileAssets);
    }

    [Fact]
    public async Task ReviewPhoto_AllowsApprovedGroupMember()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var reviewId = Guid.NewGuid();
        dbContext.Groups.Add(CreateGroup(groupId));
        await dbContext.SaveChangesAsync();

        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService
            .IsApprovedMemberAsync(groupId, memberId, Arg.Any<CancellationToken>())
            .Returns(true);
        var handler = new RegisterFileAssetCommandHandler(dbContext, authorizationService, CreateProviderResolver());

        var result = await handler.Handle(
            CreateCommand(
                memberId,
                groupId,
                FileAssetVisibility.GroupVisible,
                FileAssetPurpose.ReviewPhoto,
                "review",
                reviewId),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(memberId, result.Value?.OwnerMemberId);
        Assert.Equal("review", result.Value?.RelatedEntityType);
    }

    [Fact]
    public async Task Register_SameObjectKeyInDifferentBucketsCreatesSeparateAssets()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        var reviewId = Guid.NewGuid();
        dbContext.Groups.Add(CreateGroup(groupId));
        await dbContext.SaveChangesAsync();

        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService
            .IsApprovedMemberAsync(groupId, memberId, Arg.Any<CancellationToken>())
            .Returns(true);
        var handler = new RegisterFileAssetCommandHandler(dbContext, authorizationService, CreateProviderResolver());

        var objectKey = $"groups/{groupId}/reviews/{reviewId}/upload.webp";
        var first = await handler.Handle(
            CreateCommand(
                memberId,
                groupId,
                FileAssetVisibility.GroupVisible,
                FileAssetPurpose.ReviewPhoto,
                "review",
                reviewId) with
                {
                    BucketName = "bucket-a",
                    ObjectKey = objectKey
                },
            CancellationToken.None);
        var second = await handler.Handle(
            CreateCommand(
                memberId,
                groupId,
                FileAssetVisibility.GroupVisible,
                FileAssetPurpose.ReviewPhoto,
                "review",
                reviewId) with
                {
                    BucketName = "bucket-b",
                    ObjectKey = objectKey
                },
            CancellationToken.None);

        Assert.True(first.IsSuccess);
        Assert.True(second.IsSuccess);
        Assert.Equal(2, await dbContext.FileAssets.CountAsync());
        Assert.Contains(await dbContext.FileAssets.ToListAsync(), x => x.BucketName == "bucket-a");
        Assert.Contains(await dbContext.FileAssets.ToListAsync(), x => x.BucketName == "bucket-b");
    }

    [Fact]
    public async Task EnrollmentPaymentProof_RejectsNonMember()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        dbContext.Groups.Add(CreateGroup(groupId));
        await dbContext.SaveChangesAsync();

        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService
            .IsApprovedMemberAsync(groupId, memberId, Arg.Any<CancellationToken>())
            .Returns(false);
        var handler = new RegisterFileAssetCommandHandler(dbContext, authorizationService, CreateProviderResolver());

        var result = await handler.Handle(
            CreateCommand(
                memberId,
                groupId,
                FileAssetVisibility.MemberPrivate,
                FileAssetPurpose.EnrollmentPaymentProof,
                "enrollment",
                Guid.NewGuid()),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Equal(AppResultStatus.Forbidden, result.Status);
        Assert.Empty(dbContext.FileAssets);
    }

    [Fact]
    public async Task EnrollmentPaymentProof_DoesNotPersistPublicUrl()
    {
        using var dbContext = CreateInMemoryDbContext();
        var groupId = Guid.NewGuid();
        var memberId = Guid.NewGuid();
        dbContext.Groups.Add(CreateGroup(groupId));
        await dbContext.SaveChangesAsync();

        var authorizationService = Substitute.For<IGroupAuthorizationService>();
        authorizationService
            .IsApprovedMemberAsync(groupId, memberId, Arg.Any<CancellationToken>())
            .Returns(true);
        var handler = new RegisterFileAssetCommandHandler(dbContext, authorizationService, CreateProviderResolver());

        var result = await handler.Handle(
            CreateCommand(
                memberId,
                groupId,
                FileAssetVisibility.MemberPrivate,
                FileAssetPurpose.EnrollmentPaymentProof,
                "enrollment",
                Guid.NewGuid()),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Null(result.Value?.PublicUrl);
        Assert.Null(await dbContext.FileAssets.Select(x => x.PublicUrl).SingleAsync());
    }

    [Fact]
    public async Task BackfillMemberPrivateFiles_DryRunDoesNotUpdateMetadata()
    {
        using var dbContext = CreateInMemoryDbContext();
        var superAdminId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var file = CreateFileAsset(groupId, FileAssetVisibility.MemberPrivate, FileAssetPurpose.EnrollmentPaymentProof, "enrollment", Guid.NewGuid(), DateTime.UtcNow);
        file.ObjectKey = file.ObjectKey.Replace("private/", string.Empty);
        dbContext.Groups.Add(CreateGroup(groupId));
        AddSuperAdmin(dbContext, superAdminId);
        dbContext.FileAssets.Add(file);
        await dbContext.SaveChangesAsync();

        var mover = Substitute.For<IFileAssetObjectMover>();
        mover
            .MoveAsync(file.ObjectKey, $"private/{file.ObjectKey}", true, Arg.Any<CancellationToken>())
            .Returns(new MoveFileAssetObjectResult(true, true, false, null));
        var handler = new BackfillMemberPrivateFilesCommandHandler(dbContext, mover);

        var result = await handler.Handle(new BackfillMemberPrivateFilesCommand(superAdminId, true, 50), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.True(result.Value?.DryRun);
        Assert.Equal(file.ObjectKey, await dbContext.FileAssets.Select(x => x.ObjectKey).SingleAsync());
        Assert.NotNull(await dbContext.FileAssets.Select(x => x.PublicUrl).SingleAsync());
    }

    [Fact]
    public async Task BackfillMemberPrivateFiles_MovesObjectAndUpdatesMetadata()
    {
        using var dbContext = CreateInMemoryDbContext();
        var superAdminId = Guid.NewGuid();
        var groupId = Guid.NewGuid();
        var file = CreateFileAsset(groupId, FileAssetVisibility.MemberPrivate, FileAssetPurpose.EnrollmentPaymentProof, "enrollment", Guid.NewGuid(), DateTime.UtcNow);
        file.ObjectKey = file.ObjectKey.Replace("private/", string.Empty);
        var targetKey = $"private/{file.ObjectKey}";
        dbContext.Groups.Add(CreateGroup(groupId));
        AddSuperAdmin(dbContext, superAdminId);
        dbContext.FileAssets.Add(file);
        await dbContext.SaveChangesAsync();

        var mover = Substitute.For<IFileAssetObjectMover>();
        mover
            .MoveAsync(file.ObjectKey, targetKey, false, Arg.Any<CancellationToken>())
            .Returns(new MoveFileAssetObjectResult(true, true, true, null));
        var handler = new BackfillMemberPrivateFilesCommandHandler(dbContext, mover);

        var result = await handler.Handle(new BackfillMemberPrivateFilesCommand(superAdminId, false, 50), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(1, result.Value?.Moved);
        Assert.Equal(1, result.Value?.MetadataUpdated);
        var updated = await dbContext.FileAssets.SingleAsync();
        Assert.Equal(targetKey, updated.ObjectKey);
        Assert.Null(updated.PublicUrl);
    }

    private static RegisterFileAssetCommand CreateCommand(
        Guid memberId,
        Guid? groupId,
        FileAssetVisibility visibility,
        FileAssetPurpose purpose,
        string relatedEntityType,
        Guid relatedEntityId)
        => new(
            memberId,
            "cloudflare-r2",
            "",
            visibility == FileAssetVisibility.MemberPrivate
                ? $"private/groups/{groupId}/events/{relatedEntityId}/enrollments/{relatedEntityId}/upload.webp"
                : $"groups/{groupId}/events/{relatedEntityId}/upload.webp",
            $"https://ccalc.live/images/groups/{groupId}/events/{relatedEntityId}/upload.webp",
            "upload.png",
            "upload.webp",
            "image/webp",
            12345,
            null,
            DateTime.UtcNow,
            visibility,
            purpose,
            groupId,
            null,
            relatedEntityType,
            relatedEntityId);

    private static IFileStorageProviderResolver CreateProviderResolver()
    {
        var resolver = Substitute.For<IFileStorageProviderResolver>();
        var options = new FileStorageProviderOptions(
            Guid.Parse("f1111111-1111-4111-8111-111111111111"),
            "cloudflare-r2",
            FileStorageProviderKind.CloudflareR2,
            "ccalc",
            "https://images.ccalc.live",
            "https://images.ccalc.live",
            "https://images.ccalc.live",
            string.Empty,
            "private",
            true,
            true,
            true);
        resolver
            .GetByCodeAsync(Arg.Any<string?>(), Arg.Any<CancellationToken>())
            .Returns(options);
        resolver
            .GetDefaultAsync(Arg.Any<CancellationToken>())
            .Returns(options);
        return resolver;
    }

    private static Group CreateGroup(Guid id)
        => new()
        {
            Id = id,
            NameJson = "{\"en\":\"Group\"}",
            AccessType = AccessType.Protected,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        };

    private static GroupEvent CreateEvent(Guid eventId, Guid groupId, Guid memberId)
        => new()
        {
            Id = eventId,
            GroupId = groupId,
            CreatedByMemberId = memberId,
            TitleEn = "Event",
            TitleZh = "Event",
            StartDate = DateTime.UtcNow,
            EndDate = DateTime.UtcNow.AddHours(1),
            EventDataJson = "{}",
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        };

    private static FileAsset CreateFileAsset(
        Guid? groupId,
        FileAssetVisibility visibility,
        FileAssetPurpose purpose,
        string relatedEntityType,
        Guid relatedEntityId,
        DateTime uploadedUtc)
        => new()
        {
            Id = Guid.NewGuid(),
            StorageProvider = "cloudflare-r2",
            BucketName = string.Empty,
            ObjectKey = visibility == FileAssetVisibility.MemberPrivate
                ? $"private/groups/{groupId?.ToString() ?? "unassigned"}/{relatedEntityType}/{relatedEntityId}/upload.webp"
                : $"groups/{groupId?.ToString() ?? "unassigned"}/{relatedEntityType}/{relatedEntityId}/upload.webp",
            PublicUrl = $"https://ccalc.live/images/groups/{groupId?.ToString() ?? "unassigned"}/{relatedEntityType}/{relatedEntityId}/upload.webp",
            OriginalFileName = "upload.png",
            StoredFileName = "upload.webp",
            ContentType = "image/webp",
            SizeBytes = 12345,
            Visibility = visibility,
            Purpose = purpose,
            GroupId = groupId,
            RelatedEntityType = relatedEntityType,
            RelatedEntityId = relatedEntityId,
            UploadedUtc = uploadedUtc,
            CreatedUtc = uploadedUtc,
            UpdatedUtc = uploadedUtc
        };

    private static void AddSuperAdmin(AlifeDbContext dbContext, Guid memberId)
    {
        dbContext.Members.Add(new Member
        {
            Id = memberId,
            DisplayName = "Super Admin",
            IsRegistered = true,
            CreatedUtc = DateTime.UtcNow,
            UpdatedUtc = DateTime.UtcNow
        });
        dbContext.PlatformRoles.Add(new PlatformRole
        {
            Id = (int)PlatformRoleId.SuperAdmin,
            Code = "superadmin",
            NameJson = "{}",
            PermissionsJson = "[]",
            Level = (int)PlatformRoleId.SuperAdmin
        });
        dbContext.MemberPlatformRoles.Add(new MemberPlatformRole
        {
            Id = Guid.NewGuid(),
            MemberId = memberId,
            RoleId = (int)PlatformRoleId.SuperAdmin,
            AssignedUtc = DateTime.UtcNow
        });
    }

    private static AlifeDbContext CreateInMemoryDbContext()
    {
        var options = new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;
        return new AlifeDbContext(options);
    }
}
