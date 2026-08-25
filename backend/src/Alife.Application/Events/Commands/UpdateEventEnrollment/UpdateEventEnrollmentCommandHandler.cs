using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Transactions;

namespace Alife.Application.Events.Commands.UpdateEventEnrollment;

public sealed class UpdateEventEnrollmentCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService,
    IEventCacheInvalidationService eventCacheInvalidationService)
    : IRequestHandler<UpdateEventEnrollmentCommand, AppResult<EventEnrollmentDto>>
{
    public async Task<AppResult<EventEnrollmentDto>> Handle(
        UpdateEventEnrollmentCommand request,
        CancellationToken cancellationToken)
    {
        using var transaction = new TransactionScope(
            TransactionScopeOption.Required,
            new TransactionOptions { IsolationLevel = IsolationLevel.Serializable, Timeout = TimeSpan.FromSeconds(15) },
            TransactionScopeAsyncFlowOption.Enabled);

        var enrollment = await dbContext.EventEnrollments
            .FirstOrDefaultAsync(x => x.Id == request.EnrollmentId && x.EventId == request.EventId, cancellationToken);

        if (enrollment is null)
        {
            return AppResult<EventEnrollmentDto>.NotFound("Enrollment not found.");
        }

        if (!await CanMutateAsync(enrollment, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<EventEnrollmentDto>.Forbidden("You do not have permission to update this enrollment.");
        }

        var groupEvent = await dbContext.GroupEvents
            .AsNoTracking()
            .Include(x => x.RamAssessment)
            .FirstAsync(x => x.Id == request.EventId, cancellationToken);
        if (!EventRegistrationPolicy.IsEnabled(groupEvent))
        {
            return AppResult<EventEnrollmentDto>.Conflict("Registration is not part of this event plan.");
        }
        var isOwner = enrollment.MemberId == request.CurrentMemberId;
        if (isOwner && !EventLifecyclePolicy.CanCreateEnrollment(groupEvent, DateTime.UtcNow, out var enrollmentError))
        {
            return AppResult<EventEnrollmentDto>.Validation(enrollmentError);
        }
        if (!EventRegistrationPolicy.TryReadSettings(groupEvent, out var settings, out var settingsError))
        {
            return AppResult<EventEnrollmentDto>.Validation(settingsError);
        }
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
            .Where(x => x.EventId == request.EventId && x.Id != enrollment.Id)
            .Select(x => x.EnrollmentJson)
            .ToListAsync(cancellationToken);
        var reservedUnits = EventRegistrationPolicy.CountReservedUnits(existingPayloads, settings.CapacityUnit);
        if (reservedUnits + requestedUnits > settings.MaxCapacity)
        {
            return AppResult<EventEnrollmentDto>.Conflict("This registration would exceed the event capacity.");
        }

        enrollment.EnrollmentJson = request.EnrollmentJson;
        enrollment.UpdatedUtc = DateTime.UtcNow;

        await dbContext.SaveChangesAsync(cancellationToken);
        await eventCacheInvalidationService.RemoveEventEnrollmentsAsync(request.EventId, cancellationToken);
        transaction.Complete();

        return AppResult<EventEnrollmentDto>.Success(ToDto(enrollment));
    }

    private async Task<bool> CanMutateAsync(EventEnrollment enrollment, Guid currentMemberId, CancellationToken cancellationToken)
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
