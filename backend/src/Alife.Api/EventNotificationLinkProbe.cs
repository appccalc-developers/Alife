using Alife.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Alife.Api;

public interface IEventNotificationLinkProbe
{
    Task<bool> IsEventLinkedToRecipientAsync(Guid notificationId, Guid recipientId, CancellationToken cancellationToken);
}

public sealed class EventNotificationLinkProbe(IAlifeDbContext db) : IEventNotificationLinkProbe
{
    public Task<bool> IsEventLinkedToRecipientAsync(Guid notificationId, Guid recipientId, CancellationToken cancellationToken) =>
        db.NotificationMessages.AsNoTracking().AnyAsync(
            message => message.Id == notificationId && message.RecipientMemberId == recipientId &&
                (message.EventId != null || message.ActionType.StartsWith("event.")), cancellationToken);
}
