using Alife.Application.Events.Dtos;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Events.Services;

public sealed partial class EventActivityOperationsService
{
    private async Task NotifyChanged(GroupEvent e, Guid actor, IEnumerable<Guid> participantIds, string action, CancellationToken ct)
    {
        var ids = participantIds.Distinct().ToArray();
        if (ids.Length == 0) return;
        var people = await db.EventRegistrationParticipants.Include(p => p.Application).Where(p => ids.Contains(p.Id) && p.Application.EventId == e.Id).ToArrayAsync(ct);
        var guardians = await db.EventChildGuardianRelationships.AsNoTracking().Where(g => g.ChildRegistration.EventId == e.Id && g.ChildRegistration.IsActive && ids.Contains(g.ChildRegistration.RegistrationParticipantId) && g.Status == EventGuardianRelationshipStatus.Confirmed)
            .Select(g => new { ParticipantId = g.ChildRegistration.RegistrationParticipantId, g.GuardianMemberId }).ToArrayAsync(ct);
        var recipients = people.Where(p => !p.Application.IsInvitation || p.Application.InvitedUtc != null).SelectMany(p => p.IsChild
            ? guardians.Where(g => g.ParticipantId == p.Id).Select(g => g.GuardianMemberId)
            : new[] { p.MemberId, p.ProxyAccessRevoked ? null : (Guid?)p.Application.OrganiserMemberId }.Where(id => id.HasValue).Select(id => id!.Value)).Distinct();
        var now = DateTime.UtcNow;
        foreach (var recipient in recipients)
            db.NotificationMessages.Add(new() { Id = Guid.NewGuid(), RecipientMemberId = recipient, CreatedByMemberId = actor, EventId = e.Id, GroupId = e.GroupId,
                ActionType = action, ActionDataJson = RamEvaluator.Serialize(new { title = new LocalizedTextDto("Project registration update", "项目报名更新"), eventTitle = new LocalizedTextDto(e.TitleEn, e.TitleZh), actionUrl = $"/events/{e.Id}/registration-work" }),
                OccurredUtc = now, CreatedUtc = now, UpdatedUtc = now });
    }
}
