using Alife.Application.Admin;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.VisitContactRequests.Dtos;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace Alife.Application.VisitContactRequests.Commands.CreateVisitContactRequest;

public sealed class CreateVisitContactRequestCommandHandler(IAlifeDbContext dbContext)
    : IRequestHandler<CreateVisitContactRequestCommand, AppResult<VisitContactRequestDto>>
{
    private const string ActionType = "visitor.contact.requested";

    private static readonly System.Text.RegularExpressions.Regex EmailRegex = new(
        @"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$",
        System.Text.RegularExpressions.RegexOptions.Compiled | System.Text.RegularExpressions.RegexOptions.CultureInvariant);

    private static readonly IReadOnlyList<(string Prefix, System.Text.RegularExpressions.Regex Pattern)> PhonePatterns =
    [
        ("+86", new System.Text.RegularExpressions.Regex(@"^\+86\s?1[3-9]\d{9}$", System.Text.RegularExpressions.RegexOptions.Compiled)),
        ("+852", new System.Text.RegularExpressions.Regex(@"^\+852\s?[5-9]\d{7}$", System.Text.RegularExpressions.RegexOptions.Compiled)),
        ("+853", new System.Text.RegularExpressions.Regex(@"^\+853\s?[6-9]\d{7}$", System.Text.RegularExpressions.RegexOptions.Compiled)),
        ("+886", new System.Text.RegularExpressions.Regex(@"^\+886\s?9\d{8}$", System.Text.RegularExpressions.RegexOptions.Compiled)),
        ("+64", new System.Text.RegularExpressions.Regex(@"^\+64\s?[2-9]\d{8,9}$", System.Text.RegularExpressions.RegexOptions.Compiled)),
        ("+61", new System.Text.RegularExpressions.Regex(@"^\+61\s?[2-9]\d{8,9}$", System.Text.RegularExpressions.RegexOptions.Compiled))
    ];

    public async Task<AppResult<VisitContactRequestDto>> Handle(
        CreateVisitContactRequestCommand request,
        CancellationToken cancellationToken)
    {
        var displayName = NormalizeLength(request.DisplayName, 150);
        var email = NormalizeLength(request.Email, 200);
        var phone = NormalizeLength(request.Phone, 60);
        var message = NormalizeLength(request.Message, 2000);
        var preferredLanguage = NormalizeLanguage(request.PreferredLanguage);
        var sourcePage = NormalizeLength(request.SourcePage, 500);

        if (string.IsNullOrWhiteSpace(displayName))
        {
            return AppResult<VisitContactRequestDto>.Validation("Name is required.");
        }

        if (string.IsNullOrWhiteSpace(email) && string.IsNullOrWhiteSpace(phone))
        {
            return AppResult<VisitContactRequestDto>.Validation("Email or phone is required.");
        }

        if (!string.IsNullOrWhiteSpace(email) && !EmailRegex.IsMatch(email))
        {
            return AppResult<VisitContactRequestDto>.Validation("Email format is invalid.");
        }

        if (!string.IsNullOrWhiteSpace(phone) && !IsValidPhoneNumber(phone))
        {
            return AppResult<VisitContactRequestDto>.Validation("Phone format is invalid.");
        }

        var now = DateTime.UtcNow;
        var entity = new VisitContactRequest
        {
            Id = Guid.NewGuid(),
            DisplayName = displayName,
            Email = email,
            Phone = phone,
            PreferredLanguage = preferredLanguage,
            Message = message,
            SourcePage = sourcePage,
            Status = "new",
            SubmittedUtc = now,
            IpAddress = NormalizeLength(request.IpAddress, 64),
            UserAgent = NormalizeLength(request.UserAgent, 500),
            CreatedUtc = now,
            UpdatedUtc = now
        };

        await dbContext.VisitContactRequests.AddAsync(entity, cancellationToken);

        var recipientIds = await GetRecipientMemberIdsAsync(cancellationToken);
        foreach (var recipientId in recipientIds)
        {
            await dbContext.NotificationMessages.AddAsync(new NotificationMessage
            {
                Id = Guid.NewGuid(),
                RecipientMemberId = recipientId,
                CreatedByMemberId = recipientId,
                OccurredUtc = now,
                ActionType = ActionType,
                ActionDataJson = JsonSerializer.Serialize(new
                {
                    visitContactRequestId = entity.Id,
                    title = new
                    {
                        en = "New visitor contact request",
                        zh = "新的访客联系请求"
                    },
                    body = new
                    {
                        en = $"{displayName} left contact details from the public home page.",
                        zh = $"{displayName} 在公共首页留下了联系方式。"
                    },
                    displayName,
                    email,
                    phone,
                    preferredLanguage,
                    message,
                    sourcePage
                }),
                CreatedUtc = now,
                UpdatedUtc = now
            }, cancellationToken);
        }

        await dbContext.SaveChangesAsync(cancellationToken);

        return AppResult<VisitContactRequestDto>.Success(ToDto(entity));
    }

    private async Task<IReadOnlyList<Guid>> GetRecipientMemberIdsAsync(CancellationToken cancellationToken)
    {
        var rows = await dbContext.MemberPlatformRoles
            .AsNoTracking()
            .Where(x => x.RevokedUtc == null && x.Member.IsRegistered)
            .Select(x => new
            {
                x.MemberId,
                x.Role.Code
            })
            .ToListAsync(cancellationToken);

        return rows
            .Where(x => x.Code == AdminPlatformRoleHelpers.VisitorContactReceiverRoleCode)
            .Select(x => x.MemberId)
            .Distinct()
            .ToArray();
    }

    private static VisitContactRequestDto ToDto(VisitContactRequest entity)
        => new(
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
            entity.HandledByMember?.DisplayName,
            entity.CreatedUtc,
            entity.UpdatedUtc);

    private static string NormalizeLength(string? value, int maxLength)
    {
        var normalized = value?.Trim() ?? string.Empty;
        return normalized.Length <= maxLength ? normalized : normalized[..maxLength];
    }

    private static bool IsValidPhoneNumber(string phone)
    {
        var normalized = phone.Trim();
        foreach (var (prefix, pattern) in PhonePatterns)
        {
            if (normalized.StartsWith(prefix, StringComparison.Ordinal))
            {
                return pattern.IsMatch(normalized);
            }
        }
        return false;
    }

    private static string? NormalizeLanguage(string? value)
    {
        var normalized = NormalizeLength(value, 20).ToLowerInvariant();
        return normalized is "zh" or "en" or "bilingual" ? normalized : null;
    }
}
