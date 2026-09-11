using System.Text.Json;
using System.Text.Json.Nodes;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Composition;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Commands.SaveEventPoster;

public sealed record EventPosterBriefDto(LocalizedTextDto Title, LocalizedTextDto Description,
    LocalizedTextDto Purpose, LocalizedTextDto LocationName, DateTime StartDate, DateTime EndDate);
public sealed record EventPosterWorkspaceDto(Guid EventId, Guid GroupId, EventPosterBriefDto Brief,
    string? PosterImageUrl, string Visibility, string RegistrationMode, string ETag, bool CanManage);
public sealed record GetEventPosterQuery(Guid EventId, Guid MemberId) : IRequest<AppResult<EventPosterWorkspaceDto>>;
public sealed record SaveEventPosterCommand(Guid EventId, Guid MemberId, string? PosterImageUrl,
    string? IfMatch, string? IdempotencyKey) : IRequest<AppResult<EventPosterWorkspaceDto>>;

public sealed class EventPosterHandler(IAlifeDbContext db, IGroupAuthorizationService authorization,
    IEventCacheInvalidationService cache) :
    IRequestHandler<GetEventPosterQuery, AppResult<EventPosterWorkspaceDto>>,
    IRequestHandler<SaveEventPosterCommand, AppResult<EventPosterWorkspaceDto>>
{
    public async Task<AppResult<EventPosterWorkspaceDto>> Handle(GetEventPosterQuery request, CancellationToken ct)
    {
        var item = await db.GroupEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.EventId, ct);
        if (item is null) return AppResult<EventPosterWorkspaceDto>.NotFound("Event not found.");
        if (!await EventCompositionPersistence.CanViewEventTeamAsync(db, authorization, item, request.MemberId, ct))
            return AppResult<EventPosterWorkspaceDto>.Forbidden("Event team access is required.");
        return AppResult<EventPosterWorkspaceDto>.Success(Project(item,
            await EventCompositionPersistence.CanManageEventAsync(db, authorization, item, request.MemberId, ct)));
    }

    public async Task<AppResult<EventPosterWorkspaceDto>> Handle(SaveEventPosterCommand request, CancellationToken ct)
    {
        await using var transaction = await db.BeginSerializableTransactionAsync(ct);
        var item = await db.GroupEvents.FirstOrDefaultAsync(x => x.Id == request.EventId, ct);
        if (item is null) return AppResult<EventPosterWorkspaceDto>.NotFound("Event not found.");
        if (!await EventCompositionPersistence.CanManageEventAsync(db, authorization, item, request.MemberId, ct))
            return AppResult<EventPosterWorkspaceDto>.Forbidden("Event management authority is required.");
        if (!await EventPreparationPolicy.IsApprovedAsync(db, request.EventId, ct))
            return AppResult<EventPosterWorkspaceDto>.Conflict("event.preparation.approvalRequired: Complete formal approval before adopting a poster. / 正式审批批准后才可采用海报。");
        var key = request.IdempotencyKey?.Trim();
        if (string.IsNullOrEmpty(key) || key.Length > 200 || string.IsNullOrWhiteSpace(request.IfMatch))
            return AppResult<EventPosterWorkspaceDto>.Validation("Current poster ETag and Idempotency-Key are required.");
        var url = request.PosterImageUrl?.Trim();
        if (!string.IsNullOrEmpty(url) && (url.Length > 2048 || !Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
            uri.Scheme != Uri.UriSchemeHttps || !string.IsNullOrEmpty(uri.UserInfo)))
            return AppResult<EventPosterWorkspaceDto>.Validation("Poster must use an HTTPS image URL.");
        var hash = EventCompositionEngine.Hash(new { request.EventId, request.MemberId, url, request.IfMatch });
        var previous = await db.EventIdempotencyRecords.AsNoTracking().FirstOrDefaultAsync(x =>
            x.Operation == "event.poster.save" && x.ScopeId == item.Id && x.Key == key, ct);
        if (previous is not null)
            return previous.RequestHash == hash ? AppResult<EventPosterWorkspaceDto>.Success(Project(item, true))
                : AppResult<EventPosterWorkspaceDto>.Conflict("Idempotency-Key was used with a different poster.");
        if (request.IfMatch != ETag(item))
            return AppResult<EventPosterWorkspaceDto>.PreconditionFailed("Event details changed. Reload and review the poster again.");
        var data = JsonNode.Parse(item.EventDataJson) as JsonObject;
        if (data is null) return AppResult<EventPosterWorkspaceDto>.Validation("Event data must be a JSON object.");
        data["posterImageUrl"] = string.IsNullOrEmpty(url) ? null : url;
        item.EventDataJson = data.ToJsonString();
        item.UpdatedUtc = DateTime.UtcNow;
        // PlanConcurrencyToken is part of immutable Package source evidence. Cosmetic
        // poster edits must not rotate it; this operation uses its own ETag and transaction.
        db.EventIdempotencyRecords.Add(new() { Id = Guid.NewGuid(), Operation = "event.poster.save", ScopeId = item.Id,
            Key = key, RequestHash = hash, ResultEntityId = item.Id, CreatedUtc = item.UpdatedUtc, ExpiresUtc = item.UpdatedUtc.AddDays(7) });
        try
        {
            await db.SaveChangesAsync(ct);
            if (transaction is not null) await transaction.CommitAsync(ct);
        }
        catch (DbUpdateConcurrencyException) { return AppResult<EventPosterWorkspaceDto>.PreconditionFailed("Event changed. Reload before saving the poster."); }
        catch (DbUpdateException) { return AppResult<EventPosterWorkspaceDto>.Conflict("Poster save conflicted. Retry the same request."); }
        await cache.RemoveGroupEventsAsync(item.GroupId, ct);
        return AppResult<EventPosterWorkspaceDto>.Success(Project(item, true));
    }

    private static string ETag(GroupEvent item) => $"\"event-poster-{EventCompositionEngine.Hash(new { item.EventDataJson, item.TitleEn, item.TitleZh, item.StartDate, item.EndDate, item.UpdatedUtc })}\"";
    private static EventPosterWorkspaceDto Project(GroupEvent item, bool canManage)
    {
        using var json = JsonDocument.Parse(item.EventDataJson);
        string? Read(JsonElement source, string name) => source.ValueKind == JsonValueKind.Object && source.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
        LocalizedTextDto Text(string name) => json.RootElement.TryGetProperty(name, out var value) && value.ValueKind == JsonValueKind.Object
            ? new(Read(value, "en") ?? "", Read(value, "zh") ?? "") : new("", "");
        return new(item.Id, item.GroupId, new(new(item.TitleEn, item.TitleZh), Text("description"), Text("purpose"),
            Text("locationName"), item.StartDate, item.EndDate), Read(json.RootElement, "posterImageUrl"),
            EventVisibilityPolicy.ReadVisibility(item.EventDataJson), Read(json.RootElement, "registrationMode") ??
                (json.RootElement.TryGetProperty("maxCapacity", out var capacity) && capacity.ValueKind == JsonValueKind.Number && capacity.TryGetInt32(out var count) && count > 0 ? "required" : "none"), ETag(item), canManage);
    }
}
