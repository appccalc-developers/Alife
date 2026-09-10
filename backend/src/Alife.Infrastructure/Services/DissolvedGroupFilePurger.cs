using System.Net.Http.Json;
using Alife.Application.FileAssets.Services;
using Alife.Domain.Entities;
using Alife.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace Alife.Infrastructure.Services;

public sealed class DissolvedGroupFilePurger(
    AlifeDbContext db, HttpClient http, IConfiguration configuration, IFileStorageProviderResolver providers)
{
    public async Task<int> PurgeAsync(CancellationToken ct)
    {
        var secret = configuration["FileAssets:ImageApiAdminSecret"];
        if (string.IsNullOrWhiteSpace(secret)) return 0;
        var ids = await db.FileAssets.IgnoreQueryFilters().Where(x => x.IsDeleted && x.RelatedEntityType == "DissolvedGroup" && x.GroupId == null)
            .OrderBy(x => x.UpdatedUtc).Select(x => x.Id).Take(25).ToListAsync(ct);
        var count = 0;
        foreach (var id in ids)
        {
            // The timestamp update takes a write lock before any remote deletion.
            // Concurrent hosts cannot delete the same key after a newer registration.
            await using var transaction = await db.BeginSerializableTransactionAsync(ct);
            var file = await db.FileAssets.IgnoreQueryFilters().SingleOrDefaultAsync(x => x.Id == id, ct);
            if (file is null) continue;
            await db.Entry(file).ReloadAsync(ct);
            if (db.Entry(file).State == EntityState.Detached || !file.IsDeleted || file.RelatedEntityType != "DissolvedGroup") continue;
            file.UpdatedUtc = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
            if (await PurgeFile(file)) count++;
            if (transaction is not null) await transaction.CommitAsync(ct);
        }
        return count;

        async Task<bool> PurgeFile(FileAsset file)
        {
            if (file.RelatedEntityId is not Guid groupId ||
                !(file.ObjectKey.StartsWith($"groups/{groupId}/", StringComparison.Ordinal)
                    || file.ObjectKey.StartsWith($"private/groups/{groupId}/", StringComparison.Ordinal))) return false;
            var provider = await providers.GetByCodeAsync(file.StorageProvider, ct);
            if (provider.Code != file.StorageProvider || string.IsNullOrWhiteSpace(provider.UploadApiBaseUrl) || provider.BucketName != file.BucketName) return false;
            // A shared object must not be removed while another live asset references it.
            if (await db.FileAssets.AnyAsync(x => x.Id != file.Id && !x.IsDeleted
                && x.StorageProvider == file.StorageProvider && x.BucketName == file.BucketName && x.ObjectKey == file.ObjectKey, ct))
            {
                db.FileAssets.Remove(file);
                await db.SaveChangesAsync(ct);
                return false;
            }
            using var request = new HttpRequestMessage(HttpMethod.Post, $"{provider.UploadApiBaseUrl.TrimEnd('/')}/api/admin/file-objects/delete")
            {
                Content = JsonContent.Create(new { objectKey = file.ObjectKey, bucketName = file.BucketName, groupId })
            };
            request.Headers.Add("x-alife-file-admin-secret", secret);
            HttpResponseMessage response;
            try { response = await http.SendAsync(request, ct); }
            catch (HttpRequestException) { return false; }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested) { return false; }
            using var completedResponse = response;
            if (!response.IsSuccessStatusCode) return false;
            db.FileAssets.Remove(file);
            db.AuditLogs.Add(new AuditLog
            {
                Id = Guid.NewGuid(), Action = "group.dissolution.file-purged", EntityType = "FileAsset", EntityId = file.Id,
                MetadataJson = System.Text.Json.JsonSerializer.Serialize(new { dissolvedGroupId = file.RelatedEntityId }),
                OccurredUtc = DateTime.UtcNow
            });
            await db.SaveChangesAsync(ct);
            return true;
        }
    }
}
