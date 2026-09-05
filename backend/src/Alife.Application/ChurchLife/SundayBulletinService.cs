using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.FileAssets.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.ChurchLife;

public sealed record SundayBulletinDto(DateOnly Date, bool HasFile);
public sealed record SundayBulletinList(bool CanManage, IReadOnlyList<SundayBulletinDto> Items);

public interface ISundayBulletinStorage
{
    Task UploadAsync(FileStorageProviderOptions provider, string key, byte[] pdf, CancellationToken token);
}

public sealed class SundayBulletinService(IAlifeDbContext db, IGroupAuthorizationService authorization,
    IFileStorageProviderResolver providers, IFileAssetAccessUrlSigner signer, ISundayBulletinStorage storage)
{
    public const int MaxPdfBytes = 20 * 1024 * 1024;
    public const string KeyPrefix = "private/sunday-bulletins/";

    public static IReadOnlyList<DateOnly> Dates(DateOnly today)
    {
        var upcoming = today.AddDays((7 - (int)today.DayOfWeek) % 7);
        var dates = new List<DateOnly>();
        for (var date = upcoming; date >= today.AddMonths(-3); date = date.AddDays(-7)) dates.Add(date);
        return dates;
    }

    private static IReadOnlyList<DateOnly> CurrentDates() => Dates(DateOnly.FromDateTime(
        TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, TimeZoneInfo.FindSystemTimeZoneById("Pacific/Auckland"))));

    private async Task<Guid?> ChurchAsync(Guid memberId, bool manage, CancellationToken token)
    {
        var church = await db.Groups.AsNoTracking().Where(x => x.IsChurch && !x.IsClosed)
            .OrderBy(x => x.CreatedUtc).ThenBy(x => x.Id).Select(x => (Guid?)x.Id).FirstOrDefaultAsync(token);
        if (!church.HasValue || !await authorization.IsRegisteredMemberAsync(memberId, token)) return null;
        var allowed = manage
            ? await authorization.IsLeaderOrCoLeaderAsync(church.Value, memberId, token)
            : await authorization.IsApprovedMemberAsync(church.Value, memberId, token);
        return allowed ? church : null;
    }

    private static string Key(Guid churchId, DateOnly date) => $"{KeyPrefix}{churchId:D}/{date:yyyy-MM-dd}.pdf";

    public async Task<AppResult<SundayBulletinList>> ListAsync(Guid memberId, CancellationToken token)
    {
        var church = await ChurchAsync(memberId, false, token);
        if (!church.HasValue) return AppResult<SundayBulletinList>.Forbidden("Church membership is required.");
        var dates = CurrentDates();
        var keys = dates.Select(date => Key(church.Value, date)).ToList();
        var existing = await db.FileAssets.AsNoTracking()
            .Where(x => !x.IsDeleted && x.GroupId == church && x.Purpose == FileAssetPurpose.SundayBulletin && keys.Contains(x.ObjectKey))
            .Select(x => x.ObjectKey).ToListAsync(token);
        return AppResult<SundayBulletinList>.Success(new(
            await authorization.IsLeaderOrCoLeaderAsync(church.Value, memberId, token),
            dates.Select(date => new SundayBulletinDto(date, existing.Contains(Key(church.Value, date)))).ToList()));
    }

    public async Task<AppResult<string>> OpenAsync(Guid memberId, DateOnly date, CancellationToken token)
    {
        var church = await ChurchAsync(memberId, false, token);
        if (!church.HasValue) return AppResult<string>.Forbidden("Church membership is required.");
        var key = Key(church.Value, date);
        var file = await db.FileAssets.AsNoTracking().FirstOrDefaultAsync(x => !x.IsDeleted &&
            x.GroupId == church && x.Purpose == FileAssetPurpose.SundayBulletin && x.ObjectKey == key, token);
        if (file is null) return AppResult<string>.NotFound("Bulletin has not been uploaded.");
        return AppResult<string>.Success(await signer.CreatePrivateReadUrlAsync(file.StorageProvider, key, TimeSpan.FromMinutes(5), token));
    }

    public async Task<AppResult<bool>> UploadAsync(Guid memberId, DateOnly date, string fileName, byte[] pdf, CancellationToken token)
    {
        var church = await ChurchAsync(memberId, true, token);
        if (!church.HasValue) return AppResult<bool>.Forbidden("Church management permission is required.");
        if (!CurrentDates().Contains(date)) return AppResult<bool>.Validation("Choose a Sunday in the displayed three-month period.");
        if (Path.GetFileName(fileName).Length > 260 || !fileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase) || pdf.Length < 5 || pdf.Length > MaxPdfBytes ||
            !pdf.AsSpan(0, 5).SequenceEqual("%PDF-"u8))
            return AppResult<bool>.Validation("Upload a PDF file up to 20 MB.");
        var key = Key(church.Value, date);
        var file = await db.FileAssets.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.ObjectKey == key && x.Purpose == FileAssetPurpose.SundayBulletin, token);
        var provider = file is null ? await providers.GetDefaultAsync(token) : await providers.GetByCodeAsync(file.StorageProvider, token);
        // Check signed access configuration before replacing the existing object.
        await signer.CreatePrivateReadUrlAsync(provider.Code, key, TimeSpan.FromMinutes(5), token);
        await storage.UploadAsync(provider, key, pdf, token);
        var now = DateTime.UtcNow;
        if (file is null)
        {
            file = new FileAsset { Id = Guid.NewGuid(), CreatedUtc = now, ObjectKey = key };
            db.FileAssets.Add(file);
        }
        file.StorageProvider = provider.Code;
        file.StorageProviderId = provider.Id;
        file.BucketName = provider.BucketName;
        file.GroupId = church;
        file.OwnerMemberId = memberId;
        file.Purpose = FileAssetPurpose.SundayBulletin;
        file.Visibility = FileAssetVisibility.GroupVisible;
        file.PublicUrl = null;
        file.OriginalFileName = Path.GetFileName(fileName);
        file.StoredFileName = $"{date:yyyy-MM-dd}.pdf";
        file.ContentType = "application/pdf";
        file.SizeBytes = pdf.Length;
        file.UploadedUtc = file.UpdatedUtc = now;
        file.IsDeleted = false;
        file.DeletedUtc = null;
        await db.SaveChangesAsync(token);
        return AppResult<bool>.Success(true);
    }
}
