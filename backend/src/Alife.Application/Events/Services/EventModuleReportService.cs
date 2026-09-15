using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public sealed record EventReportRevisionDto(Guid Id, int Version, LocalizedTextDto Text, Guid AuthorMemberId, int? PlanVersion, DateTime SubmittedUtc);
public sealed record EventReportActionDto(Guid? RevisionId, string Operation, string Reason, Guid ActorMemberId, DateTime CreatedUtc);
public sealed record EventReportDto(Guid EventId, string ModuleCode, Guid? Id, LocalizedTextDto Draft, string Status,
    Guid? SubmittedRevisionId, Guid? AdoptedRevisionId, string ETag, bool CanEdit, bool CanAdopt, bool Frozen,
    IReadOnlyList<EventReportRevisionDto> Revisions, IReadOnlyList<EventReportActionDto> Actions);
public sealed record EventReportRequest(LocalizedTextDto? Text = null, Guid? RevisionId = null, string? Reason = null);

public sealed class EventModuleReportService(IAlifeDbContext db, IEventPackageInvalidationService invalidation)
{
    public static string ETag(EventModuleReport? row) => row is null ? "\"report-new\"" : $"\"report-{row.ConcurrencyToken:N}\"";

    public async Task<AppResult<EventReportDto>> GetAsync(Guid eventId, string module, Guid actor, CancellationToken ct)
    {
        if (!EventWorkAccess.ReportRoles.TryGetValue(module, out var role)) return AppResult<EventReportDto>.NotFound("Report module not found. / 未找到报告模块。");
        var e = await db.GroupEvents.AsNoTracking().FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (e is null) return AppResult<EventReportDto>.NotFound("Event not found.");
        if (!await EventWorkAccess.PlanReaderAsync(db, e, actor, ct)) return AppResult<EventReportDto>.Forbidden("Event plan access is required. / 需要活动方案查看权限。");
        var owner = await EventWorkAccess.OwnerAsync(db, e, actor, ct);
        var edit = await EventWorkAccess.RoleAsync(db, e, actor, module, role, ct);
        var frozen = await EventPreparationPolicy.IsFrozenAsync(db, eventId, ct);
        var row = await db.EventModuleReports.AsNoTracking().FirstOrDefaultAsync(x => x.EventId == eventId && x.ModuleCode == module, ct);
        var revisions = row is null ? [] : await db.EventModuleReportRevisions.AsNoTracking().Where(x => x.ReportId == row.Id)
            .OrderByDescending(x => x.Version).Select(x => new EventReportRevisionDto(x.Id, x.Version, new(x.TextEn, x.TextZh), x.AuthorMemberId, x.EventPlanVersion, x.SubmittedUtc)).ToArrayAsync(ct);
        // Working copies and unadopted history belong only to the author and accountable owner.
        var privateReader = owner || edit;
        if (!privateReader) revisions = revisions.Where(x => x.Id == row?.AdoptedRevisionId).ToArray();
        var actions = row is null || !privateReader ? [] : await db.EventModuleReportActions.AsNoTracking().Where(x => x.ReportId == row.Id)
            .OrderByDescending(x => x.CreatedUtc).Select(x => new EventReportActionDto(x.RevisionId, x.Operation, x.Reason, x.ActorMemberId, x.CreatedUtc)).ToArrayAsync(ct);
        return AppResult<EventReportDto>.Success(new(eventId, module, row?.Id,
            privateReader ? new(row?.DraftEn ?? "", row?.DraftZh ?? "") : new("", ""),
            privateReader ? row?.Status ?? "draft" : row?.AdoptedRevisionId is null ? "draft" : "adopted",
            privateReader ? row?.SubmittedRevisionId : null, row?.AdoptedRevisionId, ETag(row), edit, owner && !frozen, frozen, revisions, actions));
    }

    public async Task<AppResult<EventReportDto>> ActAsync(Guid eventId, string module, Guid actor, string operation,
        EventReportRequest request, string? expected, string? key, CancellationToken ct)
    {
        if (operation is not ("save" or "submit" or "withdraw" or "return" or "adopt")) return AppResult<EventReportDto>.Validation("Unknown report action.");
        if (string.IsNullOrWhiteSpace(key) || key.Length > 200) return AppResult<EventReportDto>.Validation("Idempotency-Key is required.");
        await using var tx = await db.BeginSerializableTransactionAsync(ct);
        await db.LockEventRegistrationAsync(eventId, ct);
        var e = await db.GroupEvents.FirstOrDefaultAsync(x => x.Id == eventId, ct);
        if (e is null || !EventWorkAccess.ReportRoles.TryGetValue(module, out var role)) return AppResult<EventReportDto>.NotFound("Event or module not found.");
        var owner = await EventWorkAccess.OwnerAsync(db, e, actor, ct);
        var author = await EventWorkAccess.RoleAsync(db, e, actor, module, role, ct);
        if (operation is "return" or "adopt" ? !owner : !author) return AppResult<EventReportDto>.Forbidden("This action belongs to the current responsible person. / 只有当前对应负责人可以处理。");
        var actionKey = $"report.{module}.{operation}.{actor:N}";
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(request))));
        var retry = await db.EventIdempotencyRecords.AsNoTracking().FirstOrDefaultAsync(x => x.Operation == actionKey && x.ScopeId == eventId && x.Key == key, ct);
        if (retry is not null) return retry.RequestHash == hash ? await GetAsync(eventId, module, actor, ct) : AppResult<EventReportDto>.Conflict("Idempotency-Key was reused for different content.");
        if (!await EventWorkAccess.EnabledAsync(db, eventId, module, ct)) return AppResult<EventReportDto>.Conflict("Module is disabled.");
        if (operation == "adopt" && await EventPreparationPolicy.IsFrozenAsync(db, eventId, ct)) return AppResult<EventReportDto>.Conflict(EventPreparationPolicy.FrozenMessage);
        var row = await db.EventModuleReports.FirstOrDefaultAsync(x => x.EventId == eventId && x.ModuleCode == module, ct);
        if (expected != ETag(row)) return AppResult<EventReportDto>.PreconditionFailed("Report changed; reload without discarding your draft. / 报告已改变，请保留草稿并重新读取。");
        if (row is null)
        {
            if (operation != "save") return AppResult<EventReportDto>.Conflict("Save the report first.");
            row = new() { Id = Guid.NewGuid(), EventId = eventId, ModuleCode = module };
            db.EventModuleReports.Add(row);
        }
        Guid? revisionId = null;
        switch (operation)
        {
            case "save":
                if (request.Text is null || (request.Text.En?.Length ?? 0) > 20000 || (request.Text.Zh?.Length ?? 0) > 20000) return AppResult<EventReportDto>.Validation("Report text is required, up to 20,000 characters per language.");
                if (row.Status == "submitted") return AppResult<EventReportDto>.Conflict("Withdraw the submission before editing.");
                row.DraftEn = request.Text.En ?? ""; row.DraftZh = request.Text.Zh ?? ""; row.Status = "draft";
                break;
            case "submit":
                if (row.Status == "submitted" || string.IsNullOrWhiteSpace(row.DraftEn) && string.IsNullOrWhiteSpace(row.DraftZh)) return AppResult<EventReportDto>.Conflict("Enter report text before submitting.");
                var revision = new EventModuleReportRevision { Id = Guid.NewGuid(), ReportId = row.Id, Version = ++row.Revision,
                    TextEn = row.DraftEn, TextZh = row.DraftZh, AuthorMemberId = actor, EventPlanVersion = e.ActivePlanVersion, SubmittedUtc = DateTime.UtcNow };
                db.EventModuleReportRevisions.Add(revision); revisionId = revision.Id;
                row.SubmittedRevisionId = revision.Id; row.Status = "submitted";
                break;
            case "withdraw":
            case "return":
            case "adopt":
                if (row.Status != "submitted" || row.SubmittedRevisionId is null || request.RevisionId != row.SubmittedRevisionId) return AppResult<EventReportDto>.Conflict("The submitted revision has changed.");
                if (operation == "return" && (string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Length > 2000)) return AppResult<EventReportDto>.Validation("A return reason is required (up to 2,000 characters).");
                var submitted = await db.EventModuleReportRevisions.AsNoTracking().FirstAsync(x => x.Id == row.SubmittedRevisionId && x.ReportId == row.Id, ct);
                if (operation == "adopt" && !await EventWorkAccess.RoleAsync(db, e, submitted.AuthorMemberId, module, role, ct)) return AppResult<EventReportDto>.Conflict("The author no longer holds this responsibility; request a new submission.");
                revisionId = row.SubmittedRevisionId;
                row.Status = operation == "adopt" ? "adopted" : operation == "return" ? "returned" : "draft";
                if (operation == "adopt")
                {
                    e.CollaborationVersion = 1;
                    row.AdoptedRevisionId = row.SubmittedRevisionId;
                    await invalidation.InvalidateForModuleChangeAsync(e, actor, module, "event.report.adopted", "operational", ct);
                }
                row.SubmittedRevisionId = null;
                break;
        }
        row.ConcurrencyToken = Guid.NewGuid(); row.UpdatedUtc = DateTime.UtcNow; row.UpdatedByMemberId = actor;
        db.EventModuleReportActions.Add(new() { Id = Guid.NewGuid(), ReportId = row.Id, RevisionId = revisionId, ActorMemberId = actor, Operation = operation, Reason = request.Reason ?? "", CreatedUtc = row.UpdatedUtc });
        db.EventIdempotencyRecords.Add(new() { Id = Guid.NewGuid(), Operation = actionKey, ScopeId = eventId, Key = key, RequestHash = hash, ResultEntityId = row.Id, CreatedUtc = row.UpdatedUtc, ExpiresUtc = row.UpdatedUtc.AddDays(1) });
        try { await db.SaveChangesAsync(ct); if (tx is not null) await tx.CommitAsync(ct); }
        catch (DbUpdateException) { return AppResult<EventReportDto>.Conflict("Report changed concurrently; reload and review."); }
        return await GetAsync(eventId, module, actor, ct);
    }
}
