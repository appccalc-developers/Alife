using System.Text.Json;
using System.Text.RegularExpressions;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Contacts.Commands.CreateContactProfile;
using Alife.Application.Contacts.Dtos;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Contacts.Commands.CreateContactInquiry;

public sealed class CreateContactInquiryCommandHandler(IAlifeDbContext dbContext, IGroupAuthorizationService authorizationService)
    : IRequestHandler<CreateContactInquiryCommand, AppResult<ContactInquiryDto>>
{
    private static readonly Regex EmailRegex = new(@"^[^\s@]+@[^\s@]+\.[^\s@]+$", RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public async Task<AppResult<ContactInquiryDto>> Handle(CreateContactInquiryCommand request, CancellationToken cancellationToken)
    {
        var profile = await dbContext.ContactProfiles.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.ContactProfileId, cancellationToken);
        if (profile is null) return AppResult<ContactInquiryDto>.NotFound("Contact profile not found.");

        if (profile.Visibility == ContactProfileVisibility.GroupOnly &&
            (request.CurrentMemberId is not Guid memberId ||
             !await authorizationService.IsApprovedMemberAsync(profile.OwnerGroupId, memberId, cancellationToken)))
        {
            return AppResult<ContactInquiryDto>.Forbidden("This contact is only available to group members.");
        }

        var name = CreateContactProfileCommandHandler.Trim(request.DisplayName, 150);
        var email = CreateContactProfileCommandHandler.Trim(request.Email, 200);
        var phone = CreateContactProfileCommandHandler.Trim(request.Phone, 60);
        var message = CreateContactProfileCommandHandler.Trim(request.Message, 2000);
        if (name is null || message is null) return AppResult<ContactInquiryDto>.Validation("Name and message are required.");
        if (email is null && phone is null) return AppResult<ContactInquiryDto>.Validation("Email or phone is required.");
        if (email is not null && !EmailRegex.IsMatch(email)) return AppResult<ContactInquiryDto>.Validation("Email format is invalid.");

        var now = DateTime.UtcNow;
        var inquiry = new ContactInquiry
        {
            Id = Guid.NewGuid(),
            ContactProfileId = profile.Id,
            OwnerGroupId = profile.OwnerGroupId,
            SubmittedByMemberId = request.CurrentMemberId,
            DisplayName = name,
            Email = email,
            Phone = phone,
            Message = message,
            PreferredLanguage = CreateContactProfileCommandHandler.Trim(request.PreferredLanguage, 20),
            SourcePage = CreateContactProfileCommandHandler.Trim(request.SourcePage, 500),
            IpAddress = CreateContactProfileCommandHandler.Trim(request.IpAddress, 64),
            UserAgent = CreateContactProfileCommandHandler.Trim(request.UserAgent, 500),
            SubmittedUtc = now,
            CreatedUtc = now,
            UpdatedUtc = now
        };
        dbContext.ContactInquiries.Add(inquiry);

        dbContext.NotificationMessages.Add(new NotificationMessage
        {
            Id = Guid.NewGuid(),
            RecipientMemberId = profile.MemberId,
            CreatedByMemberId = request.CurrentMemberId ?? profile.MemberId,
            GroupId = profile.OwnerGroupId,
            OccurredUtc = now,
            ActionType = "contact.inquiry.received",
            ActionDataJson = JsonSerializer.Serialize(new
            {
                contactInquiryId = inquiry.Id,
                contactProfileId = profile.Id,
                title = new { en = "New contact inquiry", zh = "新的联系人留言" },
                body = new { en = $"{name} sent you a contact inquiry.", zh = $"{name} 给你发送了联系人留言。" },
                displayName = name,
                email,
                phone,
                message,
                preferredLanguage = inquiry.PreferredLanguage,
                sourcePage = inquiry.SourcePage
            }),
            CreatedUtc = now,
            UpdatedUtc = now
        });

        await dbContext.SaveChangesAsync(cancellationToken);
        return AppResult<ContactInquiryDto>.Success(new ContactInquiryDto(
            inquiry.Id, inquiry.ContactProfileId, inquiry.OwnerGroupId, inquiry.SubmittedByMemberId,
            inquiry.DisplayName, inquiry.Email, inquiry.Phone, inquiry.Message, inquiry.PreferredLanguage, inquiry.SubmittedUtc));
    }
}
