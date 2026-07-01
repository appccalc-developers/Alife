using Alife.Application.Admin;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.VisitContactRequests.Dtos;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Alife.Application.VisitContactRequests.Commands.UpdateVisitContactRequestStatus;

public sealed class UpdateVisitContactRequestStatusCommandHandler(IAlifeDbContext dbContext)
    : IRequestHandler<UpdateVisitContactRequestStatusCommand, AppResult<VisitContactRequestDto>>
{
    public async Task<AppResult<VisitContactRequestDto>> Handle(
        UpdateVisitContactRequestStatusCommand request,
        CancellationToken cancellationToken)
    {
        if (!await AdminPlatformRoleHelpers.HasPermissionAsync(
                dbContext,
                request.CurrentMemberId,
                AdminPermissionCatalog.ReceiveVisitorContactRequests,
                cancellationToken))
        {
            return AppResult<VisitContactRequestDto>.Forbidden("You do not have permission to update visitor contact requests.");
        }

        var nextStatus = NormalizeStatus(request.Status);
        if (nextStatus is null)
        {
            return AppResult<VisitContactRequestDto>.Validation("Status must be new, followUp, or contacted.");
        }

        var entity = await dbContext.VisitContactRequests
            .Include(x => x.HandledByMember)
            .FirstOrDefaultAsync(x => x.Id == request.RequestId, cancellationToken);
        if (entity is null)
        {
            return AppResult<VisitContactRequestDto>.NotFound("Visitor contact request was not found.");
        }

        var beforeStatus = entity.Status;
        var now = DateTime.UtcNow;
        entity.Status = nextStatus;
        entity.UpdatedUtc = now;
        if (nextStatus is "contacted")
        {
            entity.HandledUtc = now;
            entity.HandledByMemberId = request.CurrentMemberId;
        }
        else
        {
            entity.HandledUtc = null;
            entity.HandledByMemberId = null;
        }

        await dbContext.AuditLogs.AddAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorMemberId = request.CurrentMemberId,
            Action = "visit-contact.status.update",
            EntityType = "visit_contact_request",
            EntityId = entity.Id,
            BeforeJson = JsonSerializer.Serialize(new { status = beforeStatus }),
            AfterJson = JsonSerializer.Serialize(new { status = nextStatus }),
            OccurredUtc = now
        }, cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);

        var handledByDisplayName = entity.HandledByMemberId is null
            ? null
            : await dbContext.Members
                .Where(x => x.Id == entity.HandledByMemberId)
                .Select(x => x.DisplayName)
                .FirstOrDefaultAsync(cancellationToken);

        return AppResult<VisitContactRequestDto>.Success(new VisitContactRequestDto(
            entity.Id,
            entity.DisplayName,
            entity.Email,
            entity.Phone,
            entity.PreferredLanguage,
            entity.Message,
            entity.SourcePage,
            entity.Status,
            entity.SubmittedUtc,
            entity.HandledUtc,
            entity.HandledByMemberId,
            handledByDisplayName,
            entity.CreatedUtc,
            entity.UpdatedUtc));
    }

    private static string? NormalizeStatus(string? status)
    {
        var normalized = status?.Trim().ToLowerInvariant();
        return normalized switch
        {
            "new" => "new",
            "followup" or "follow-up" or "follow_up" => "followUp",
            "contacted" => "contacted",
            _ => null
        };
    }
}
