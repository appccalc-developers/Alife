using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Transactions;

namespace Alife.Application.Events.Commands.EnrollGroupEvent;

public sealed class EnrollGroupEventCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<EnrollGroupEventCommand, AppResult<EventEnrollmentDto>>
{
    public async Task<AppResult<EventEnrollmentDto>> Handle(EnrollGroupEventCommand request, CancellationToken cancellationToken)
    {
        var canEnroll = await groupAuthorizationService.IsApprovedMemberAsync(
            request.GroupId,
            request.CurrentMemberId,
            cancellationToken);

        if (!canEnroll)
        {
            return AppResult<EventEnrollmentDto>.Forbidden("Only approved group members can enroll in events.");
        }

        using var transaction = new TransactionScope(
            TransactionScopeOption.Required,
            new TransactionOptions { IsolationLevel = IsolationLevel.Serializable, Timeout = TimeSpan.FromSeconds(15) },
            TransactionScopeAsyncFlowOption.Enabled);

        var groupEvent = await dbContext.GroupEvents
            .AsNoTracking()
            .Include(x => x.RamAssessment)
            .FirstOrDefaultAsync(
                x => x.Id == request.EventId && x.GroupId == request.GroupId,
                cancellationToken);

        if (groupEvent is null)
        {
            return AppResult<EventEnrollmentDto>.NotFound("Event not found.");
        }
        if (!EventRegistrationPolicy.IsEnabled(groupEvent))
        {
            return AppResult<EventEnrollmentDto>.Conflict("Registration is not part of this event plan.");
        }

        var now = DateTime.UtcNow;
        if (!EventLifecyclePolicy.CanCreateEnrollment(groupEvent, now, out var enrollmentError))
        {
            return AppResult<EventEnrollmentDto>.Validation(enrollmentError);
        }

        var enrollment = await dbContext.EventEnrollments
            .FirstOrDefaultAsync(
                x => x.GroupId == request.GroupId &&
                     x.EventId == request.EventId &&
                     x.MemberId == request.CurrentMemberId,
                cancellationToken);

        EventRegistrationPolicy.TryReadSettings(groupEvent, out var settings, out _);
        if (!EventRegistrationPolicy.ValidateEnrollmentRequirements(groupEvent, request.EnrollmentJson, out var requirementsError))
        {
            return AppResult<EventEnrollmentDto>.Validation(requirementsError);
        }
        if (!EventRegistrationPolicy.TryReadReservedUnits(
                request.EnrollmentJson, settings.CapacityUnit, out var requestedUnits, out var unitsError))
        {
            return AppResult<EventEnrollmentDto>.Validation(unitsError);
        }
        var existingPayloads = await dbContext.EventEnrollments.AsNoTracking()
            .Where(x => x.EventId == request.EventId && (enrollment == null || x.Id != enrollment.Id))
            .Select(x => x.EnrollmentJson)
            .ToListAsync(cancellationToken);
        var reservedUnits = EventRegistrationPolicy.CountReservedUnits(existingPayloads, settings.CapacityUnit);
        if (reservedUnits + requestedUnits > settings.MaxCapacity)
        {
            return AppResult<EventEnrollmentDto>.Conflict("This registration would exceed the event capacity.");
        }

        if (enrollment is null)
        {
            enrollment = new EventEnrollment
            {
                Id = Guid.NewGuid(),
                GroupId = request.GroupId,
                EventId = request.EventId,
                MemberId = request.CurrentMemberId,
                EnrollmentJson = request.EnrollmentJson,
                CreatedUtc = now,
                UpdatedUtc = now,
            };
            dbContext.EventEnrollments.Add(enrollment);
        }
        else
        {
            enrollment.EnrollmentJson = request.EnrollmentJson;
            enrollment.UpdatedUtc = now;
        }

        await dbContext.SaveChangesAsync(cancellationToken);
        transaction.Complete();

        return AppResult<EventEnrollmentDto>.Success(ToDto(enrollment));
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
