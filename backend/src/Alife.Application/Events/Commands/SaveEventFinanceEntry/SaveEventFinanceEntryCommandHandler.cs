using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Commands.SaveEventFinanceEntry;

public sealed class SaveEventFinanceEntryCommandHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<SaveEventFinanceEntryCommand, AppResult<EventFinanceEntryDto>>
{
    public async Task<AppResult<EventFinanceEntryDto>> Handle(SaveEventFinanceEntryCommand request, CancellationToken cancellationToken)
    {
        if (!Enum.IsDefined(request.Type)) return AppResult<EventFinanceEntryDto>.Validation("Finance entry type is invalid.");
        if (request.Amount <= 0 || request.Amount > 100000000)
            return AppResult<EventFinanceEntryDto>.Validation("Amount must be greater than zero and within the supported range.");
        if (string.IsNullOrWhiteSpace(request.Category) || request.Category.Trim().Length > 100)
            return AppResult<EventFinanceEntryDto>.Validation("Category is required and cannot exceed 100 characters.");
        if (request.DescriptionEn.Trim().Length == 0 || request.DescriptionZh.Trim().Length == 0)
            return AppResult<EventFinanceEntryDto>.Validation("Describe the actual entry in both languages.");
        if (request.DescriptionEn.Length > 500 || request.DescriptionZh.Length > 500)
            return AppResult<EventFinanceEntryDto>.Validation("Finance descriptions cannot exceed 500 characters per language.");

        var groupEvent = await db.GroupEvents
            .Include(x => x.FinanceReconciliation)
            .Include(x => x.ClosureReport)
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent is null) return AppResult<EventFinanceEntryDto>.NotFound("Event not found.");
        if (!await authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, request.CurrentMemberId, cancellationToken))
            return AppResult<EventFinanceEntryDto>.Forbidden("Only event leaders can record actual finances.");
        if (!EventFinancePolicy.IsEnabled(groupEvent))
            return AppResult<EventFinanceEntryDto>.Conflict("Add finance to this event plan before recording actual finances.");
        if (request.OccurredUtc < groupEvent.StartDate.AddYears(-1) || request.OccurredUtc > DateTime.UtcNow.AddMinutes(5))
            return AppResult<EventFinanceEntryDto>.Validation("The transaction date is outside the allowed event accounting period.");

        EventFinanceEntry? entry = null;
        if (request.EntryId is Guid entryId)
        {
            entry = await db.EventFinanceEntries.FirstOrDefaultAsync(x => x.Id == entryId && x.EventId == groupEvent.Id, cancellationToken);
            if (entry is null) return AppResult<EventFinanceEntryDto>.NotFound("Finance entry not found.");
        }
        var now = DateTime.UtcNow;
        var before = entry is null ? null : JsonSerializer.Serialize(new { entry.Type, entry.Category, entry.Amount, entry.OccurredUtc });
        if (entry is null)
        {
            entry = new EventFinanceEntry { Id = Guid.NewGuid(), EventId = groupEvent.Id, CreatedUtc = now };
            db.EventFinanceEntries.Add(entry);
        }
        entry.Type = request.Type;
        entry.Category = request.Category.Trim();
        entry.DescriptionEn = request.DescriptionEn.Trim();
        entry.DescriptionZh = request.DescriptionZh.Trim();
        entry.Amount = decimal.Round(request.Amount, 2, MidpointRounding.AwayFromZero);
        entry.OccurredUtc = request.OccurredUtc;
        entry.RecordedByMemberId = request.CurrentMemberId;
        entry.UpdatedUtc = now;
        InvalidateConfirmations(groupEvent, now);
        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(), ActorMemberId = request.CurrentMemberId, Action = "event.finance.actual.saved",
            EntityType = nameof(EventFinanceEntry), EntityId = entry.Id, GroupId = groupEvent.GroupId, EventId = groupEvent.Id,
            BeforeJson = before, AfterJson = JsonSerializer.Serialize(new { entry.Type, entry.Category, entry.Amount, entry.OccurredUtc }),
            OccurredUtc = now
        });
        await db.SaveChangesAsync(cancellationToken);
        return AppResult<EventFinanceEntryDto>.Success(ToDto(entry));
    }

    internal static void InvalidateConfirmations(GroupEvent groupEvent, DateTime now)
    {
        if (groupEvent.FinanceReconciliation is not null)
        {
            groupEvent.FinanceReconciliation.LeaderConfirmed = false;
            groupEvent.FinanceReconciliation.ConfirmedByMemberId = null;
            groupEvent.FinanceReconciliation.ConfirmedUtc = null;
            groupEvent.FinanceReconciliation.UpdatedUtc = now;
        }
        if (groupEvent.ClosureReport is not null)
        {
            groupEvent.ClosureReport.LeaderConfirmed = false;
            groupEvent.ClosureReport.ConfirmedByMemberId = null;
            groupEvent.ClosureReport.ConfirmedUtc = null;
            groupEvent.ClosureReport.UpdatedUtc = now;
        }
    }

    internal static EventFinanceEntryDto ToDto(EventFinanceEntry entry) => new(
        entry.Id, entry.Type.ToString(), entry.Category,
        new WorkflowTextDto(entry.DescriptionEn, entry.DescriptionZh), entry.Amount, entry.OccurredUtc, entry.UpdatedUtc);
}
