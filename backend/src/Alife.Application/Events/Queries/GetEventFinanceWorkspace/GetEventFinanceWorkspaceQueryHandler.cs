using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Queries.GetEventFinanceWorkspace;

public sealed class GetEventFinanceWorkspaceQueryHandler(IAlifeDbContext db, IGroupAuthorizationService authorization)
    : IRequestHandler<GetEventFinanceWorkspaceQuery, AppResult<EventFinanceWorkspaceDto>>
{
    public async Task<AppResult<EventFinanceWorkspaceDto>> Handle(GetEventFinanceWorkspaceQuery request, CancellationToken cancellationToken)
    {
        var groupEvent = await db.GroupEvents.AsNoTracking()
            .Include(x => x.FinanceReconciliation).ThenInclude(x => x!.ConfirmedByMember)
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent is null) return AppResult<EventFinanceWorkspaceDto>.NotFound("Event not found.");
        if (!await authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, request.CurrentMemberId, cancellationToken))
            return AppResult<EventFinanceWorkspaceDto>.Forbidden("Only event leaders can manage event finances.");
        if (!EventFinancePolicy.IsEnabled(groupEvent))
            return AppResult<EventFinanceWorkspaceDto>.Conflict("Add finance to this event plan before opening the finance workspace.");

        EventFinancePolicy.TryReadSettings(groupEvent, out var settings, out _);
        var enrollmentRows = await db.EventEnrollments.AsNoTracking()
            .Where(x => x.EventId == request.EventId)
            .OrderByDescending(x => x.UpdatedUtc)
            .Select(x => new { x.Id, x.EnrollmentJson, x.UpdatedUtc })
            .ToListAsync(cancellationToken);
        var evidence = enrollmentRows
            .Select(x => ReadEvidence(x.Id, x.EnrollmentJson, x.UpdatedUtc))
            .Where(x => x.FileCount > 0)
            .ToArray();
        var moduleStatus = EventFinancePolicy.ModuleStatus(groupEvent);
        var actualEntries = await db.EventFinanceEntries.AsNoTracking()
            .Where(x => x.EventId == groupEvent.Id)
            .OrderByDescending(x => x.OccurredUtc)
            .Select(x => new EventFinanceEntryDto(
                x.Id, x.Type.ToString(), x.Category, new WorkflowTextDto(x.DescriptionEn, x.DescriptionZh),
                x.Amount, x.OccurredUtc, x.UpdatedUtc))
            .ToArrayAsync(cancellationToken);
        var actualIncome = actualEntries.Where(x => x.Type == "Income").Sum(x => x.Amount);
        var actualExpense = actualEntries.Where(x => x.Type == "Expense").Sum(x => x.Amount);
        var reconciliation = groupEvent.FinanceReconciliation;
        return AppResult<EventFinanceWorkspaceDto>.Success(new EventFinanceWorkspaceDto(
            groupEvent.Id, groupEvent.GroupId, groupEvent.TitleEn, groupEvent.TitleZh,
            moduleStatus.ToString(), settings.Currency, settings.AdultFee, settings.ChildFee,
            new WorkflowTextDto(settings.PaymentInstructions.En, settings.PaymentInstructions.Zh),
            new WorkflowTextDto(settings.RefundPolicy.En, settings.RefundPolicy.Zh),
            settings.PaymentEvidenceRequired, settings.LeaderConfirmed,
            settings.Options.Select(x => new EventFinanceOptionDto(x.Id, new WorkflowTextDto(x.Name.En, x.Name.Zh), x.ExtraFee)).ToArray(),
            evidence.Length, evidence.Sum(x => x.FileCount), evidence,
            groupEvent.EndDate <= DateTime.UtcNow, actualIncome, actualExpense, actualIncome - actualExpense,
            actualEntries, reconciliation is null
                ? new EventFinanceReconciliationDto(new WorkflowTextDto(string.Empty, string.Empty), false, null, null, null, null)
                : new EventFinanceReconciliationDto(
                    new WorkflowTextDto(reconciliation.NotesEn, reconciliation.NotesZh), reconciliation.LeaderConfirmed,
                    reconciliation.ConfirmedByMemberId, reconciliation.ConfirmedByMember?.DisplayName,
                    reconciliation.ConfirmedUtc, reconciliation.UpdatedUtc)));
    }

    private static EventPaymentEvidenceSummaryDto ReadEvidence(Guid id, string enrollmentJson, DateTime updatedUtc)
    {
        try
        {
            using var document = JsonDocument.Parse(enrollmentJson);
            var root = document.RootElement;
            var name = root.TryGetProperty("applicantName", out var applicant) && applicant.ValueKind == JsonValueKind.String
                ? applicant.GetString()?.Trim() ?? string.Empty : string.Empty;
            var count = root.TryGetProperty("paymentFiles", out var files) && files.ValueKind == JsonValueKind.Array
                ? files.GetArrayLength() : 0;
            return new EventPaymentEvidenceSummaryDto(id, name, count, updatedUtc);
        }
        catch (JsonException)
        {
            return new EventPaymentEvidenceSummaryDto(id, string.Empty, 0, updatedUtc);
        }
    }
}
