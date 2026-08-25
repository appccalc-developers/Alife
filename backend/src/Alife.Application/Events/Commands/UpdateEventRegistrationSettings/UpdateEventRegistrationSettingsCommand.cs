using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using MediatR;

namespace Alife.Application.Events.Commands.UpdateEventRegistrationSettings;

public sealed record UpdateEventRegistrationSettingsCommand(
    Guid EventId,
    Guid CurrentMemberId,
    int MaxCapacity,
    string CapacityUnit,
    DateTime? RegistrationDeadlineUtc)
    : IRequest<AppResult<GroupEventSummaryDto>>;
