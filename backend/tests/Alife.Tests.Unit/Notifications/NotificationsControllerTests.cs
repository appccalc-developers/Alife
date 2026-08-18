using System.Text.Json;
using Alife.Api.Controllers;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Common.Models;
using Alife.Application.Notifications.Dtos;
using Alife.Application.Notifications.Commands.MarkNotificationRead;
using Alife.Application.Notifications.Queries.ListCurrentNotificationTasks;
using Alife.Application.Notifications.Queries.ListNotifications;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;

namespace Alife.Tests.Unit.Notifications;

public class NotificationsControllerTests
{
    [Fact]
    public async Task List_WhenAuthenticated_ReturnsCurrentMembersNotifications()
    {
        var memberId = Guid.NewGuid();
        var mediator = Substitute.For<IMediator>();
        var currentMemberAccessor = Substitute.For<ICurrentMemberAccessor>();
        currentMemberAccessor.GetCurrentMemberId().Returns(memberId);
        mediator
            .Send(Arg.Any<ListNotificationsQuery>(), Arg.Any<CancellationToken>())
            .Returns(AppResult<IReadOnlyList<NotificationMessageDto>>.Success([
                CreateNotification(memberId)
            ]));
        var controller = CreateController(mediator, currentMemberAccessor);

        var result = await controller.List(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var notifications = Assert.IsAssignableFrom<IEnumerable<NotificationMessageDto>>(ok.Value).ToList();
        Assert.Single(notifications);
        Assert.Equal(memberId, notifications[0].RecipientMemberId);
    }

    [Fact]
    public async Task ListCurrent_WhenAuthenticated_ReturnsPrivateCurrentTasks()
    {
        var memberId = Guid.NewGuid();
        var mediator = Substitute.For<IMediator>();
        var currentMemberAccessor = Substitute.For<ICurrentMemberAccessor>();
        currentMemberAccessor.GetCurrentMemberId().Returns(memberId);
        mediator
            .Send(Arg.Any<ListCurrentNotificationTasksQuery>(), Arg.Any<CancellationToken>())
            .Returns(AppResult<IReadOnlyList<CurrentNotificationTaskDto>>.Success([
                CreateCurrentTask(memberId)
            ]));
        var controller = CreateController(mediator, currentMemberAccessor);

        var result = await controller.ListCurrent(CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var tasks = Assert.IsAssignableFrom<IEnumerable<CurrentNotificationTaskDto>>(ok.Value).ToList();
        Assert.Single(tasks);
        Assert.Equal(memberId, tasks[0].RecipientMemberId);
        Assert.Equal("private, no-cache", controller.Response.Headers.CacheControl);
        Assert.Contains("Cookie", controller.Response.Headers.Vary.ToString());
        Assert.Contains("Authorization", controller.Response.Headers.Vary.ToString());
    }

    [Fact]
    public async Task ListCurrent_WhenUnauthenticated_ReturnsUnauthorized()
    {
        var controller = CreateController(Substitute.For<IMediator>(), Substitute.For<ICurrentMemberAccessor>());

        var result = await controller.ListCurrent(CancellationToken.None);

        Assert.IsType<UnauthorizedResult>(result);
    }

    [Fact]
    public async Task Create_WhenActionDataIsNotObject_ReturnsBadRequest()
    {
        var memberId = Guid.NewGuid();
        var mediator = Substitute.For<IMediator>();
        var currentMemberAccessor = Substitute.For<ICurrentMemberAccessor>();
        currentMemberAccessor.GetCurrentMemberId().Returns(memberId);
        var controller = CreateController(mediator, currentMemberAccessor);
        using var document = JsonDocument.Parse("\"not-object\"");

        var result = await controller.Create(
            new NotificationsController.CreateNotificationRequest(
                memberId,
                null,
                null,
                null,
                "personal.followup",
                document.RootElement.Clone()),
            CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task MarkRead_WhenAuthenticated_ReturnsNotification()
    {
        var memberId = Guid.NewGuid();
        var notificationId = Guid.NewGuid();
        var mediator = Substitute.For<IMediator>();
        var currentMemberAccessor = Substitute.For<ICurrentMemberAccessor>();
        currentMemberAccessor.GetCurrentMemberId().Returns(memberId);
        mediator
            .Send(Arg.Any<MarkNotificationReadCommand>(), Arg.Any<CancellationToken>())
            .Returns(AppResult<NotificationMessageDto>.Success(CreateNotification(memberId, notificationId, DateTime.UtcNow)));
        var controller = CreateController(mediator, currentMemberAccessor);

        var result = await controller.MarkRead(notificationId, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        var notification = Assert.IsType<NotificationMessageDto>(ok.Value);
        Assert.Equal(notificationId, notification.Id);
        Assert.NotNull(notification.ReadUtc);
    }

    private static NotificationMessageDto CreateNotification(Guid memberId)
        => CreateNotification(memberId, Guid.NewGuid(), readUtc: null);

    private static NotificationMessageDto CreateNotification(Guid memberId, Guid notificationId, DateTime? readUtc)
        => new(
            notificationId,
            memberId,
            Guid.NewGuid(),
            null,
            null,
            DateTime.UtcNow,
            "personal.followup",
            "{}",
            null,
            readUtc,
            null,
            DateTime.UtcNow,
            DateTime.UtcNow);

    private static CurrentNotificationTaskDto CreateCurrentTask(Guid memberId)
        => new(
            Guid.NewGuid(),
            memberId,
            Guid.NewGuid(),
            null,
            null,
            DateTime.UtcNow,
            "personal.followup",
            "{}",
            null,
            null,
            null,
            DateTime.UtcNow,
            DateTime.UtcNow,
            null,
            "general",
            "read",
            null);

    private static NotificationsController CreateController(
        IMediator mediator,
        ICurrentMemberAccessor currentMemberAccessor)
        => new(mediator, currentMemberAccessor)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };
}
