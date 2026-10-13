using System.Text.Json;
using Alife.Application.Events.Dtos;
using Alife.Domain.Entities;

namespace Alife.Application.Events.Services;

public static class EventRamPolicy
{
    public static bool IsValidJson(string ramDataJson)
    {
        try
        {
            using var document = JsonDocument.Parse(ramDataJson);
            return document.RootElement.ValueKind == JsonValueKind.Object;
        }
        catch (JsonException)
        {
            return false;
        }
    }

    public static EventRamAssessmentDto ToDto(EventRamAssessment ram, Guid groupId) =>
        new(
            ram.EventId,
            groupId,
            ram.RamDataJson,
            ram.Status,
            ram.SubmittedByMemberId,
            ram.SubmittedUtc,
            ram.ApprovedByMemberId,
            ram.ApprovedUtc,
            ram.CreatedUtc,
            ram.UpdatedUtc, ram.SchemaVersion, ram.ConcurrencyToken.ToString("D"), ram.PolicyVersionId,
            ram.CurrentRevisionId, ram.Validity, ram.ResidualLevel, ram.AuthorMemberId, ram.ReviewRequested,
            new(ram.SyncStatus, ram.IsUpdated, ram.LastEvaluatedAt, ram.SyncError, ram.SyncReviewedByMemberId, ram.SyncReviewedAt));

}
