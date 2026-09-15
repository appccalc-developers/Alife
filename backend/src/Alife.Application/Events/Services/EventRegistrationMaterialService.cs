using System.Text;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.FileAssets.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;
namespace Alife.Application.Events.Services;

public interface IEventRegistrationStorage
{
    Task UploadAsync(FileStorageProviderOptions provider, string key, byte[] bytes, string contentType, CancellationToken ct);
    Task<byte[]> DownloadAsync(FileStorageProviderOptions provider, string key, CancellationToken ct);
}
public sealed record RegistrationFileDto(Guid Id, string RequirementId, string Name, long SizeBytes, string OpenUrl);
public sealed record RegistrationDownload(byte[] Bytes, string ContentType, string Name);
public sealed class EventRegistrationMaterialService(IAlifeDbContext db, IFileStorageProviderResolver providers, IEventRegistrationStorage storage)
{
    public const int MaxBytes = 20 * 1024 * 1024;
    public static async Task<bool> CanAccessAsync(IAlifeDbContext db, Guid participantId, Guid actor, CancellationToken ct)
    {
        var p = await db.EventRegistrationParticipants.AsNoTracking().Include(x => x.Application).ThenInclude(x => x.Event).FirstOrDefaultAsync(x => x.Id == participantId, ct);
        if (p is null) return false;
        var app = p.Application;
        if (await EventWorkAccess.OwnerAsync(db, app.Event, actor, ct) || await EventWorkAccess.RoleAsync(db, app.Event, actor, "PEOPLE.REGISTRATION", "registration.manager", ct)) return true;
        return (!app.IsInvitation || app.InvitedUtc.HasValue) && (app.OrganiserMemberId == actor && !p.ProxyAccessRevoked || p.MemberId == actor || p.IsChild && p.GuardianMemberId == actor);
    }
    public async Task<AppResult<IReadOnlyList<RegistrationFileDto>>> ListAsync(Guid eventId, Guid participantId, Guid actor, CancellationToken ct)
    {
        if (!await db.EventRegistrationParticipants.AnyAsync(x => x.Id == participantId && x.Application.EventId == eventId, ct) || !await CanAccessAsync(db, participantId, actor, ct)) return AppResult<IReadOnlyList<RegistrationFileDto>>.Forbidden("Participant material access is required.");
        var rows = await db.EventRegistrationMaterials.AsNoTracking().Include(x => x.FileAsset).Where(x => x.ParticipantId == participantId && !x.FileAsset.IsDeleted).ToArrayAsync(ct);
        return AppResult<IReadOnlyList<RegistrationFileDto>>.Success(rows.Select(x => new RegistrationFileDto(x.FileAssetId, x.RequirementId, x.FileAsset.OriginalFileName, x.FileAsset.SizeBytes, $"/api/file-assets/{x.FileAssetId}/open")).ToArray());
    }
    public async Task<AppResult<RegistrationDownload>> DownloadAsync(Guid fileId, Guid actor, CancellationToken ct)
    {
        var file = await db.FileAssets.AsNoTracking().FirstOrDefaultAsync(x => x.Id == fileId && !x.IsDeleted, ct);
        if (file is null) return AppResult<RegistrationDownload>.NotFound("Material not found.");
        if (file.Purpose != FileAssetPurpose.EventRegistrationMaterial || file.RelatedEntityId is not { } participant || !await CanAccessAsync(db, participant, actor, ct)) return AppResult<RegistrationDownload>.Forbidden("Participant material access is required.");
        try
        {
            var provider = await providers.GetByCodeAsync(file.StorageProvider, ct);
            var bytes = await storage.DownloadAsync(provider, file.ObjectKey, ct);
            // Recheck after storage I/O as responsibility may have been withdrawn in the meantime.
            if (!await CanAccessAsync(db, participant, actor, ct) || !await db.FileAssets.AnyAsync(x => x.Id == fileId && !x.IsDeleted, ct)) return AppResult<RegistrationDownload>.Forbidden("Responsibility or material availability changed.");
            return AppResult<RegistrationDownload>.Success(new(bytes, file.ContentType, file.OriginalFileName));
        }
        catch (HttpRequestException) { return AppResult<RegistrationDownload>.Conflict("Material storage is unavailable."); }
        catch (InvalidOperationException) { return AppResult<RegistrationDownload>.Conflict("Private material storage is not configured."); }
    }
    public async Task<AppResult<RegistrationFileDto>> UploadAsync(Guid eventId, Guid participantId, string requirementId, Guid actor, string name, byte[] bytes, string? expected, CancellationToken ct)
    {
        if (bytes.Length is < 1 or > MaxBytes) return AppResult<RegistrationFileDto>.Validation("Upload a file up to 20 MB.");
        var ext = Path.GetExtension(name).ToLowerInvariant();
        var contentType = ext switch { ".jpg" or ".jpeg" => "image/jpeg", ".png" => "image/png", ".pdf" => "application/pdf", ".txt" => "text/plain", _ => "" };
        if (contentType.Length == 0 || !ValidBytes(contentType, bytes)) return AppResult<RegistrationFileDto>.Validation("Use a valid JPG, PNG, PDF or UTF-8 text file.");
        if (!await CanAccessAsync(db, participantId, actor, ct)) return AppResult<RegistrationFileDto>.Forbidden("Participant material access is required.");
        await using var tx = await db.BeginSerializableTransactionAsync(ct); await db.LockEventRegistrationAsync(eventId, ct);
        var participant = await db.EventRegistrationParticipants.Include(x => x.Application).FirstOrDefaultAsync(x => x.Id == participantId && x.Application.EventId == eventId, ct);
        if (participant is null) return AppResult<RegistrationFileDto>.NotFound("Participant not found.");
        if (!await CanAccessAsync(db, participantId, actor, ct)) return AppResult<RegistrationFileDto>.Forbidden("Responsibility changed.");
        if (expected != EventRegistrationWorkService.ApplicationETag(participant.Application)) return AppResult<RegistrationFileDto>.PreconditionFailed("Registration changed.");
        if (participant.SeatStatus is "confirmed" or "cancelled" or "expired") return AppResult<RegistrationFileDto>.Conflict("This submission no longer accepts new materials.");
        if (participant.Application.IsInvitation && participant.Application.ReservationExpiresUtc <= DateTime.UtcNow)
            return AppResult<RegistrationFileDto>.Conflict("The invitation has expired.");
        if (!await EventWorkAccess.EnabledAsync(db, eventId, "PEOPLE.REGISTRATION", ct)) return AppResult<RegistrationFileDto>.Conflict("Registration is disabled for this event.");
        var policy = await db.EventRegistrationPolicies.AsNoTracking().FirstOrDefaultAsync(x => x.EventId == eventId, ct);
        if (policy is null || participant.Application.PolicyVersion != policy.Version || EventRegistrationWorkService.Rules(policy).DeadlineUtc < DateTime.UtcNow) return AppResult<RegistrationFileDto>.Conflict("Rules changed or the submission deadline passed.");
        var requirement = EventRegistrationWorkService.Rules(policy).Materials.FirstOrDefault(x => x.Id == requirementId && x.Kind != "text");
        if (requirement is null || requirement.Kind == "image" && !contentType.StartsWith("image/") || bytes.LongLength > requirement.MaxBytes) return AppResult<RegistrationFileDto>.Validation("This file does not meet the configured requirement.");
        if (await db.EventRegistrationMaterials.CountAsync(x => x.ParticipantId == participantId && x.RequirementId == requirementId && !x.FileAsset.IsDeleted, ct) >= requirement.MaxCount) return AppResult<RegistrationFileDto>.Conflict("Maximum file count reached.");
        var provider = await providers.GetDefaultAsync(ct);
        if (!provider.SupportsSignedRead) return AppResult<RegistrationFileDto>.Conflict("Configure private file storage before accepting materials.");
        var id = Guid.NewGuid(); var objectKey = $"private/event-registration/{eventId:N}/{participantId:N}/{id:N}{ext}";
        try { await storage.UploadAsync(provider, objectKey, bytes, contentType, ct); }
        catch (HttpRequestException) { return AppResult<RegistrationFileDto>.Conflict("File storage is unavailable. Your form has been preserved."); }
        catch (InvalidOperationException) { return AppResult<RegistrationFileDto>.Conflict("Private upload storage is not configured."); }
        var now = DateTime.UtcNow;
        var file = new FileAsset { Id = id, StorageProvider = provider.Code, StorageProviderId = provider.Id, BucketName = provider.BucketName, ObjectKey = objectKey, OriginalFileName = Path.GetFileName(name), StoredFileName = id.ToString("N") + ext,
            ContentType = contentType, SizeBytes = bytes.LongLength, Visibility = FileAssetVisibility.MemberPrivate, Purpose = FileAssetPurpose.EventRegistrationMaterial,
            OwnerMemberId = actor, RelatedEntityType = "eventRegistrationParticipant", RelatedEntityId = participantId, UploadedUtc = now, CreatedUtc = now, UpdatedUtc = now };
        // Load the group explicitly; the application query intentionally does not broaden the participant projection.
        file.GroupId = await db.GroupEvents.Where(x => x.Id == eventId).Select(x => x.GroupId).SingleAsync(ct);
        db.FileAssets.Add(file); db.EventRegistrationMaterials.Add(new() { Id = Guid.NewGuid(), ParticipantId = participantId, FileAssetId = id, RequirementId = requirementId, UploadedByMemberId = actor, CreatedUtc = now });
        participant.MaterialsVerified = false; participant.ProcedureStatus = "incomplete"; participant.Application.ConcurrencyToken = Guid.NewGuid();
        db.EventRegistrationActions.Add(new() { Id = Guid.NewGuid(), EventId = eventId, ApplicationId = participant.ApplicationId, ParticipantId = participantId, ActorMemberId = actor, Operation = "material.uploaded", SnapshotJson = System.Text.Json.JsonSerializer.Serialize(new { fileId = id, requirementId }), CreatedUtc = now });
        await db.SaveChangesAsync(ct); if (tx is not null) await tx.CommitAsync(ct);
        return AppResult<RegistrationFileDto>.Success(new(id, requirementId, file.OriginalFileName, file.SizeBytes, $"/api/file-assets/{id}/open"));
    }
    public static bool ValidBytes(string type, byte[] bytes)
    {
        if (type == "image/jpeg") return bytes.Length >= 3 && bytes[0] == 255 && bytes[1] == 216 && bytes[2] == 255;
        if (type == "image/png") return bytes.Length >= 8 && bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 });
        if (type == "application/pdf") return bytes.Length >= 5 && Encoding.ASCII.GetString(bytes, 0, 5) == "%PDF-";
        try { return !new UTF8Encoding(false, true).GetString(bytes).Contains('\0'); } catch (DecoderFallbackException) { return false; }
    }
}
