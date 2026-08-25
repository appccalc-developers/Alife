using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Transactions;

namespace Alife.Application.Events.Commands.CreateEventEnrollment;

public sealed class CreateEventEnrollmentCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IEventCacheInvalidationService eventCacheInvalidationService)
    : IRequestHandler<CreateEventEnrollmentCommand, AppResult<EventEnrollmentDto>>
{
    public async Task<AppResult<EventEnrollmentDto>> Handle(
        CreateEventEnrollmentCommand request,
        CancellationToken cancellationToken)
    {
        var eventIdentity = await dbContext.GroupEvents
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == request.EventId, cancellationToken);

        if (eventIdentity is null)
        {
            return AppResult<EventEnrollmentDto>.NotFound("Event not found.");
        }

        var canEnroll = await groupAuthorizationService.IsApprovedMemberAsync(
            eventIdentity.GroupId,
            request.CurrentMemberId,
            cancellationToken);

        if (!canEnroll)
        {
            return AppResult<EventEnrollmentDto>.Forbidden("You must be an approved member to enroll.");
        }

        using var transaction = new TransactionScope(
            TransactionScopeOption.Required,
            new TransactionOptions { IsolationLevel = IsolationLevel.Serializable, Timeout = TimeSpan.FromSeconds(15) },
            TransactionScopeAsyncFlowOption.Enabled);

        var groupEvent = await dbContext.GroupEvents
            .AsNoTracking()
            .Include(x => x.RamAssessment)
            .FirstAsync(x => x.Id == request.EventId, cancellationToken);
        if (!EventRegistrationPolicy.IsEnabled(groupEvent))
        {
            return AppResult<EventEnrollmentDto>.Conflict("Registration is not part of this event plan.");
        }
        var now = DateTime.UtcNow;
        if (!EventLifecyclePolicy.CanCreateEnrollment(groupEvent, now, out var enrollmentError))
        {
            return AppResult<EventEnrollmentDto>.Validation(enrollmentError);
        }

        var existingEnrollment = await dbContext.EventEnrollments
            .AsNoTracking()
            .AnyAsync(x => x.EventId == request.EventId && x.MemberId == request.CurrentMemberId, cancellationToken);

        if (existingEnrollment)
        {
            return AppResult<EventEnrollmentDto>.Conflict("Enrollment already exists for this event and member.");
        }

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
            .Where(x => x.EventId == request.EventId)
            .Select(x => x.EnrollmentJson)
            .ToListAsync(cancellationToken);
        var reservedUnits = EventRegistrationPolicy.CountReservedUnits(existingPayloads, settings.CapacityUnit);
        if (reservedUnits + requestedUnits > settings.MaxCapacity)
        {
            return AppResult<EventEnrollmentDto>.Conflict("This registration would exceed the event capacity.");
        }

        if (request.RequestedId.HasValue)
        {
            var idAlreadyExists = await dbContext.EventEnrollments
                .AsNoTracking()
                .AnyAsync(x => x.Id == request.RequestedId.Value, cancellationToken);

            if (idAlreadyExists)
            {
                return AppResult<EventEnrollmentDto>.Conflict("Enrollment id already exists.");
            }
        }

        var enrollment = new EventEnrollment
        {
            Id = request.RequestedId ?? Guid.NewGuid(),
            GroupId = groupEvent.GroupId,
            EventId = request.EventId,
            MemberId = request.CurrentMemberId,
            EnrollmentJson = request.EnrollmentJson,
            CreatedUtc = now,
            UpdatedUtc = now,
        };

        dbContext.EventEnrollments.Add(enrollment);
        await dbContext.SaveChangesAsync(cancellationToken);
        await eventCacheInvalidationService.RemoveEventEnrollmentsAsync(request.EventId, cancellationToken);
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
