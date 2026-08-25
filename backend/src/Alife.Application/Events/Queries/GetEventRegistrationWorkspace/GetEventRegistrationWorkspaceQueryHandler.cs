using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Queries.GetEventRegistrationWorkspace;

public sealed class GetEventRegistrationWorkspaceQueryHandler(
    IAlifeDbContext db,
    IGroupAuthorizationService authorization)
    : IRequestHandler<GetEventRegistrationWorkspaceQuery, AppResult<EventRegistrationWorkspaceDto>>
{
    public async Task<AppResult<EventRegistrationWorkspaceDto>> Handle(
        GetEventRegistrationWorkspaceQuery request,
        CancellationToken cancellationToken)
    {
        var groupEvent = await db.GroupEvents.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);
        if (groupEvent is null) return AppResult<EventRegistrationWorkspaceDto>.NotFound("Event not found.");
        if (!await authorization.IsLeaderOrCoLeaderAsync(groupEvent.GroupId, request.CurrentMemberId, cancellationToken))
            return AppResult<EventRegistrationWorkspaceDto>.Forbidden("Only event leaders can manage registration settings.");
        if (!EventRegistrationPolicy.IsEnabled(groupEvent))
            return AppResult<EventRegistrationWorkspaceDto>.Conflict("Add registration to this event plan before opening the registration workspace.");

        EventRegistrationPolicy.TryReadSettings(groupEvent, out var settings, out var settingsError);
        var enrollmentRows = await db.EventEnrollments.AsNoTracking()
            .Where(x => x.EventId == request.EventId)
            .OrderByDescending(x => x.UpdatedUtc)
            .Select(x => new { x.Id, x.MemberId, x.EnrollmentJson, x.UpdatedUtc })
            .ToListAsync(cancellationToken);
        var registrations = enrollmentRows.Select(row =>
        {
            EventRegistrationPolicy.TryReadReservedUnits(row.EnrollmentJson, settings.CapacityUnit, out var units, out _);
            return new EventRegistrationEntryDto(
                row.Id,
                row.MemberId,
                ReadApplicantName(row.EnrollmentJson),
                Math.Max(1, units),
                row.UpdatedUtc);
        }).ToArray();
        var reservedUnits = registrations.Sum(x => x.ReservedUnits);
        var remainingUnits = Math.Max(0, settings.MaxCapacity - reservedUnits);
        var now = DateTime.UtcNow;
        var (status, reason) = ResolveStatus(groupEvent.StartDate, settings, settingsError, reservedUnits, now);

        return AppResult<EventRegistrationWorkspaceDto>.Success(new EventRegistrationWorkspaceDto(
            groupEvent.Id,
            groupEvent.GroupId,
            groupEvent.TitleEn,
            groupEvent.TitleZh,
            groupEvent.StartDate,
            settings.MaxCapacity,
            settings.CapacityUnit,
            settings.RegistrationDeadlineUtc?.UtcDateTime,
            status,
            reason,
            registrations.Length,
            reservedUnits,
            remainingUnits,
            registrations));
    }

    private static (string Status, string Reason) ResolveStatus(
        DateTime startUtc,
        EventRegistrationSettings settings,
        string settingsError,
        int reservedUnits,
        DateTime utcNow)
    {
        if (!string.IsNullOrWhiteSpace(settingsError)) return ("invalid", settingsError);
        if (!settings.IsConfigured) return ("notConfigured", "Set a capacity and registration deadline before opening registration.");
        if (settings.RegistrationDeadlineUtc!.Value.UtcDateTime > startUtc)
            return ("invalid", "The registration deadline must be before the event starts.");
        if (reservedUnits >= settings.MaxCapacity) return ("full", "The configured capacity has been reached.");
        if (settings.RegistrationDeadlineUtc.Value.UtcDateTime < utcNow)
            return ("closed", "The registration deadline has passed.");
        return ("open", string.Empty);
    }

    private static string ReadApplicantName(string json)
    {
        try
        {
            using var document = JsonDocument.Parse(json);
            return document.RootElement.TryGetProperty("applicantName", out var name)
                && name.ValueKind == JsonValueKind.String
                ? name.GetString()?.Trim() ?? string.Empty
                : string.Empty;
        }
        catch (JsonException)
        {
            return string.Empty;
        }
    }
}
