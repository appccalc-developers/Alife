using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Alife.Application.Admin.Commands.SendAdminMessage;

public sealed class SendAdminMessageCommandHandler(IAlifeDbContext dbContext)
    : IRequestHandler<SendAdminMessageCommand, AppResult<AdminSendMessageResultDto>>
{
    public async Task<AppResult<AdminSendMessageResultDto>> Handle(
        SendAdminMessageCommand request,
        CancellationToken cancellationToken)
    {
        if (!await AdminPlatformRoleHelpers.IsPlatformAdminAsync(dbContext, request.CurrentMemberId, cancellationToken))
        {
            return AppResult<AdminSendMessageResultDto>.Forbidden("Platform admin access is required.");
        }

        var actionType = string.IsNullOrWhiteSpace(request.ActionType)
            ? "platform.message"
            : request.ActionType.Trim();
        if (actionType.Length > 100)
        {
            return AppResult<AdminSendMessageResultDto>.Validation("Action type must be 100 characters or fewer.");
        }

        if (string.IsNullOrWhiteSpace(request.TitleEn) && string.IsNullOrWhiteSpace(request.TitleZh))
        {
            return AppResult<AdminSendMessageResultDto>.Validation("Message title is required.");
        }

        if (string.IsNullOrWhiteSpace(request.BodyEn) && string.IsNullOrWhiteSpace(request.BodyZh))
        {
            return AppResult<AdminSendMessageResultDto>.Validation("Message body is required.");
        }

        var scope = request.Scope.Trim().ToLowerInvariant();
        if (scope is not ("platform" or "group" or "member"))
        {
            return AppResult<AdminSendMessageResultDto>.Validation("Message scope must be platform, group, or member.");
        }

        if (scope == "group" && request.GroupId is null)
        {
            return AppResult<AdminSendMessageResultDto>.Validation("Group is required.");
        }

        if (scope == "member" && request.RecipientMemberId is null)
        {
            return AppResult<AdminSendMessageResultDto>.Validation("Recipient member is required.");
        }

        var recipientIdsQuery = scope switch
        {
            "platform" => dbContext.Members
                .AsNoTracking()
                .Where(x => x.IsRegistered)
                .Select(x => x.Id),
            "group" => dbContext.GroupMemberships
                .AsNoTracking()
                .Where(x => x.GroupId == request.GroupId!.Value && x.Status == MembershipStatus.Approved && x.Member.IsRegistered)
                .Select(x => x.MemberId),
            _ => dbContext.Members
                .AsNoTracking()
                .Where(x => x.Id == request.RecipientMemberId!.Value && x.IsRegistered)
                .Select(x => x.Id)
        };

        var recipientIds = await recipientIdsQuery.Distinct().ToListAsync(cancellationToken);
        if (recipientIds.Count == 0)
        {
            return AppResult<AdminSendMessageResultDto>.Validation("No registered recipients were found.");
        }

        var now = DateTime.UtcNow;
        var actionDataJson = JsonSerializer.Serialize(new
        {
            title = new { en = request.TitleEn.Trim(), zh = request.TitleZh.Trim() },
            body = new { en = request.BodyEn.Trim(), zh = request.BodyZh.Trim() },
            scope
        });

        foreach (var recipientId in recipientIds)
        {
            dbContext.NotificationMessages.Add(new NotificationMessage
            {
                Id = Guid.NewGuid(),
                RecipientMemberId = recipientId,
                CreatedByMemberId = request.CurrentMemberId,
                GroupId = request.GroupId,
                ActionType = actionType,
                ActionDataJson = actionDataJson,
                OccurredUtc = now,
                CreatedUtc = now,
                UpdatedUtc = now
            });
        }

        await dbContext.AuditLogs.AddAsync(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorMemberId = request.CurrentMemberId,
            Action = "notification.admin.send",
            EntityType = "notification",
            GroupId = request.GroupId,
            TargetMemberId = scope == "member" ? request.RecipientMemberId : null,
            AfterJson = JsonSerializer.Serialize(new
            {
                scope,
                actionType,
                recipientCount = recipientIds.Count,
                title = new { en = request.TitleEn.Trim(), zh = request.TitleZh.Trim() }
            }),
            OccurredUtc = now
        }, cancellationToken);

        await dbContext.SaveChangesAsync(cancellationToken);
        return AppResult<AdminSendMessageResultDto>.Success(new AdminSendMessageResultDto(recipientIds.Count));
    }
}
