using System.Text.Json;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Microsoft.EntityFrameworkCore;
namespace Alife.Application.Events.Services;

public sealed partial class EventRegistrationWorkService
{
    public async Task<AppResult<IReadOnlyList<RegistrationHistoryDto>>> HistoryAsync(Guid eventId, Guid applicationId, Guid actor, int page, CancellationToken ct)
    {
        var app = await db.EventRegistrationApplications.AsNoTracking().Include(x => x.Event).Include(x => x.Participants)
            .FirstOrDefaultAsync(x => x.Id == applicationId && x.EventId == eventId, ct);
        if (app is null) return AppResult<IReadOnlyList<RegistrationHistoryDto>>.NotFound("Application not found.");
        var manager = await Manager(app.Event, actor, ct); var finance = await Finance(app.Event, actor, ct);
        var own = app.Participants.Where(p => app.OrganiserMemberId == actor && !p.ProxyAccessRevoked || p.MemberId == actor || p.IsChild && p.GuardianMemberId == actor).Select(p => p.Id).ToArray();
        if (!manager && !finance && (own.Length == 0 || app.IsInvitation && app.InvitedUtc is null)) return AppResult<IReadOnlyList<RegistrationHistoryDto>>.Forbidden("Application history access is required.");
        var query = db.EventRegistrationActions.AsNoTracking().Where(x => x.EventId == eventId && x.ApplicationId == applicationId);
        if (finance && !manager) query = query.Where(x => x.Operation == "payment" || x.Operation == "refund");
        else if (manager && !finance) query = query.Where(x => x.Operation != "payment" && x.Operation != "refund");
        else if (!manager && !finance) query = query.Where(x => x.ParticipantId != null && own.Contains(x.ParticipantId.Value) || x.ParticipantId == null && app.OrganiserMemberId == actor && !app.Participants.Any(p => p.ProxyAccessRevoked));
        var rows = await query.OrderByDescending(x => x.CreatedUtc).ThenByDescending(x => x.Id).Skip((Math.Max(1, page) - 1) * 30).Take(30).ToArrayAsync(ct);
        var values = rows.Select(x =>
        {
            long? amount = null;
            if (x.Operation is "payment" or "refund")
            {
                using var json = JsonDocument.Parse(x.SnapshotJson);
                if (json.RootElement.TryGetProperty("amountMinor", out var field) && field.TryGetInt64(out var parsed)) amount = parsed;
            }
            return new RegistrationHistoryDto(x.Id, x.ActorMemberId, x.Operation, x.Evidence, x.CreatedUtc, x.ParticipantId, amount);
        }).ToArray();
        return AppResult<IReadOnlyList<RegistrationHistoryDto>>.Success(values);
    }
}
