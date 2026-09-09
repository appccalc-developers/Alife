using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.FileAssets.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace Alife.Application.ChurchLife;

public sealed record SundayBulletinDto(DateOnly Date, bool HasFile);
public sealed record SundayBulletinList(bool CanManage, IReadOnlyList<SundayBulletinDto> Items);

public interface ISundayBulletinStorage
{
    Task UploadAsync(FileStorageProviderOptions provider, string key, byte[] pdf, CancellationToken token);
}

public sealed class SundayBulletinService(IAlifeDbContext db, IGroupAuthorizationService authorization,
    IFileStorageProviderResolver providers, IFileAssetAccessUrlSigner signer, ISundayBulletinStorage storage,
    ILogger<SundayBulletinService>? logger = null)
{
    public const int MaxPdfBytes = 20 * 1024 * 1024;
    public const string KeyPrefix = "private/sunday-bulletins/";
    private const string StorageUnavailable = "Bulletin storage is unavailable. Please contact a church administrator.";

    private bool IsStorageFailure(Exception error, CancellationToken token)
    {
        if (error is not (InvalidOperationException or HttpRequestException) &&
            !(error is OperationCanceledException && !token.IsCancellationRequested)) return false;
        // Do not log file names, signed URLs, request content or credentials.
        logger?.LogWarning("Sunday bulletin storage failed: {FailureType}; HTTP status: {StatusCode}",
            error.GetType().Name, (error as HttpRequestException)?.StatusCode);
        return true;
    }

    private async Task<IReadOnlyList<DateOnly>> SermonDatesAsync(CancellationToken token) =>
        (await db.Sermons.AsNoTracking().Where(sermon => !sermon.IsDeleted && sermon.PreachedAtUtc.HasValue)
            .Select(sermon => sermon.PreachedAtUtc!.Value.Date).Distinct().OrderDescending().ToListAsync(token))
        .Select(DateOnly.FromDateTime).ToArray();

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

    public async Task<AppResult<SundayBulletinList>> ListAsync(Guid memberId, CancellationToken token, IReadOnlyList<DateOnly>? requestedDates = null)
    {
        var church = await ChurchAsync(memberId, false, token);
        if (!church.HasValue) return AppResult<SundayBulletinList>.Forbidden("Church membership is required.");
        if (requestedDates?.Count > 100)
            return AppResult<SundayBulletinList>.Validation("Request up to 100 sermon dates at a time.");
        var sermonDates = await SermonDatesAsync(token);
        var dates = requestedDates is { Count: > 0 } ? requestedDates.Distinct().OrderDescending().ToArray() : sermonDates;
        if (dates.Any(date => !sermonDates.Contains(date)))
            return AppResult<SundayBulletinList>.Validation("Choose a date associated with a sermon video.");
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
        try
        {
            return AppResult<string>.Success(await signer.CreatePrivateReadUrlAsync(file.StorageProvider, key, TimeSpan.FromMinutes(5), token));
        }
        catch (Exception error) when (IsStorageFailure(error, token))
        {
            return AppResult<string>.ServiceUnavailable(StorageUnavailable);
        }
    }

    public async Task<AppResult<bool>> UploadAsync(Guid memberId, DateOnly date, string fileName, byte[] pdf, CancellationToken token)
    {
        var church = await ChurchAsync(memberId, true, token);
        if (!church.HasValue) return AppResult<bool>.Forbidden("Church management permission is required.");
        var dateStart = date.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc);
        if (!await db.Sermons.AsNoTracking().AnyAsync(sermon => !sermon.IsDeleted && sermon.PreachedAtUtc.HasValue &&
                sermon.PreachedAtUtc.Value.Date == dateStart, token))
            return AppResult<bool>.Validation("Choose a date associated with a sermon video.");
        if (Path.GetFileName(fileName).Length > 260 || !fileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase) || pdf.Length < 5 || pdf.Length > MaxPdfBytes ||
            !pdf.AsSpan(0, 5).SequenceEqual("%PDF-"u8))
            return AppResult<bool>.Validation("Upload a PDF file up to 20 MB.");
        var key = Key(church.Value, date);
        var file = await db.FileAssets.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.ObjectKey == key && x.Purpose == FileAssetPurpose.SundayBulletin, token);
        var provider = file is null ? await providers.GetDefaultAsync(token) : await providers.GetByCodeAsync(file.StorageProvider, token);
        // Check signed access configuration before replacing the existing object.
        try
        {
            await signer.CreatePrivateReadUrlAsync(provider.Code, key, TimeSpan.FromMinutes(5), token);
            await storage.UploadAsync(provider, key, pdf, token);
        }
        catch (Exception error) when (IsStorageFailure(error, token))
        {
            return AppResult<bool>.ServiceUnavailable(StorageUnavailable);
        }
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
