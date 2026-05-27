using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Events.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api/events/{eventId:guid}/enrollments")]
[Authorize]
public class EventEnrollmentsController(
    AlifeDbContext dbContext,
    ICurrentMemberAccessor currentMemberAccessor,
    IGroupAuthorizationService groupAuthorizationService) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(Guid eventId, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var groupEvent = await GetEventAsync(eventId, cancellationToken);
        if (groupEvent is null)
        {
            return NotFound(new { message = "Event not found." });
        }

        var isLeader = await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
            groupEvent.GroupId,
            currentMemberId.Value,
            cancellationToken);
        var isApprovedMember = isLeader || await groupAuthorizationService.IsApprovedMemberAsync(
            groupEvent.GroupId,
            currentMemberId.Value,
            cancellationToken);

        if (!isApprovedMember)
        {
            return Forbid();
        }

        var query = dbContext.EventEnrollments
            .AsNoTracking()
            .Where(x => x.EventId == eventId);

        if (!isLeader)
        {
            query = query.Where(x => x.MemberId == currentMemberId.Value);
        }

        var enrollments = await query
            .OrderByDescending(x => x.UpdatedUtc)
            .Select(x => new EventEnrollmentDto(
                x.Id,
                x.GroupId,
                x.EventId,
                x.MemberId,
                x.EnrollmentJson,
                x.CreatedUtc,
                x.UpdatedUtc))
            .ToListAsync(cancellationToken);

        return Ok(enrollments);
    }

    [HttpPost]
    public async Task<IActionResult> Create(Guid eventId, [FromBody] JsonElement enrollmentJson, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        if (!IsJsonObject(enrollmentJson))
        {
            return BadRequest(new { message = "Enrollment payload must be a JSON object." });
        }

        var groupEvent = await GetEventAsync(eventId, cancellationToken);
        if (groupEvent is null)
        {
            return NotFound(new { message = "Event not found." });
        }

        var canEnroll = await groupAuthorizationService.IsApprovedMemberAsync(
            groupEvent.GroupId,
            currentMemberId.Value,
            cancellationToken);

        if (!canEnroll)
        {
            return Forbid();
        }

        var existingEnrollment = await dbContext.EventEnrollments
            .AsNoTracking()
            .AnyAsync(x => x.EventId == eventId && x.MemberId == currentMemberId.Value, cancellationToken);
        if (existingEnrollment)
        {
            return Conflict(new { message = "Enrollment already exists for this event and member." });
        }

        if (!TryReadRequestedEnrollmentId(enrollmentJson, out var requestedEnrollmentId, out var enrollmentIdError))
        {
            return BadRequest(new { message = enrollmentIdError });
        }

        if (requestedEnrollmentId.HasValue)
        {
            var idAlreadyExists = await dbContext.EventEnrollments
                .AsNoTracking()
                .AnyAsync(x => x.Id == requestedEnrollmentId.Value, cancellationToken);
            if (idAlreadyExists)
            {
                return Conflict(new { message = "Enrollment id already exists." });
            }
        }

        var now = DateTime.UtcNow;
        var enrollment = new EventEnrollment
        {
            Id = requestedEnrollmentId ?? Guid.NewGuid(),
            GroupId = groupEvent.GroupId,
            EventId = eventId,
            MemberId = currentMemberId.Value,
            EnrollmentJson = enrollmentJson.GetRawText(),
            CreatedUtc = now,
            UpdatedUtc = now,
        };

        dbContext.EventEnrollments.Add(enrollment);
        await dbContext.SaveChangesAsync(cancellationToken);

        return CreatedAtAction(nameof(List), new { eventId }, ToDto(enrollment));
    }

    [HttpPut("{enrollmentId:guid}")]
    public async Task<IActionResult> Update(Guid eventId, Guid enrollmentId, [FromBody] JsonElement enrollmentJson, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        if (!IsJsonObject(enrollmentJson))
        {
            return BadRequest(new { message = "Enrollment payload must be a JSON object." });
        }

        var enrollment = await dbContext.EventEnrollments
            .FirstOrDefaultAsync(x => x.Id == enrollmentId && x.EventId == eventId, cancellationToken);
        if (enrollment is null)
        {
            return NotFound(new { message = "Enrollment not found." });
        }

        if (!await CanMutateEnrollmentAsync(enrollment, currentMemberId.Value, cancellationToken))
        {
            return Forbid();
        }

        enrollment.EnrollmentJson = enrollmentJson.GetRawText();
        enrollment.UpdatedUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);

        return Ok(ToDto(enrollment));
    }

    [HttpDelete("{enrollmentId:guid}")]
    public async Task<IActionResult> Delete(Guid eventId, Guid enrollmentId, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var enrollment = await dbContext.EventEnrollments
            .FirstOrDefaultAsync(x => x.Id == enrollmentId && x.EventId == eventId, cancellationToken);
        if (enrollment is null)
        {
            return NotFound(new { message = "Enrollment not found." });
        }

        if (!await CanMutateEnrollmentAsync(enrollment, currentMemberId.Value, cancellationToken))
        {
            return Forbid();
        }

        dbContext.EventEnrollments.Remove(enrollment);
        await dbContext.SaveChangesAsync(cancellationToken);

        return NoContent();
    }

    private Task<GroupEvent?> GetEventAsync(Guid eventId, CancellationToken cancellationToken)
        => dbContext.GroupEvents
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == eventId, cancellationToken);

    private async Task<bool> CanMutateEnrollmentAsync(EventEnrollment enrollment, Guid currentMemberId, CancellationToken cancellationToken)
    {
        if (enrollment.MemberId == currentMemberId)
        {
            return true;
        }

        return await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
            enrollment.GroupId,
            currentMemberId,
            cancellationToken);
    }

    private static bool IsJsonObject(JsonElement value)
        => value.ValueKind == JsonValueKind.Object;

    private static bool TryReadRequestedEnrollmentId(
        JsonElement enrollmentJson,
        out Guid? enrollmentId,
        out string? error)
    {
        enrollmentId = null;
        error = null;

        foreach (var propertyName in new[] { "id", "enrollmentId" })
        {
            if (!enrollmentJson.TryGetProperty(propertyName, out var property))
            {
                continue;
            }

            if (property.ValueKind == JsonValueKind.Null)
            {
                continue;
            }

            if (property.ValueKind != JsonValueKind.String ||
                !Guid.TryParse(property.GetString(), out var parsed) ||
                parsed == Guid.Empty)
            {
                error = $"{propertyName} must be a non-empty GUID when provided.";
                return false;
            }

            enrollmentId = parsed;
            return true;
        }

        return true;
    }

    private static EventEnrollmentDto ToDto(EventEnrollment enrollment) =>
        new(
            enrollment.Id,
            enrollment.GroupId,
            enrollment.EventId,
            enrollment.MemberId,
            enrollment.EnrollmentJson,
            enrollment.CreatedUtc,
            enrollment.UpdatedUtc);
}
