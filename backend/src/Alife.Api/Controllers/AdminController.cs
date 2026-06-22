using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Admin.Commands.RefreshCloudflareCache;
using Alife.Application.Admin.Commands.SendAdminMessage;
using Alife.Application.Admin.Commands.SetMemberPlatformRole;
using Alife.Application.Admin.Commands.SyncSermons;
using Alife.Application.Admin.Queries.GetAdminSelfDiagnostic;
using Alife.Application.Admin.Queries.ListAdminGroups;
using Alife.Application.Admin.Queries.ListAdminMembers;
using Alife.Application.Admin.Queries.ListAdminNotifications;
using Alife.Application.Admin.Queries.ListAuditLogs;
using Alife.Application.Admin.Queries.ListPlatformRoles;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize]
public class AdminController(IMediator mediator, ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
    [HttpGet("self-diagnostic")]
    public async Task<IActionResult> SelfDiagnostic(CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(new GetAdminSelfDiagnosticQuery(currentMemberId.Value), cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpGet("platform-roles")]
    public async Task<IActionResult> ListPlatformRoles(CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(new ListPlatformRolesQuery(currentMemberId.Value), cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpGet("members")]
    public async Task<IActionResult> ListMembers(
        [FromQuery] string? search,
        [FromQuery] string? role,
        [FromQuery] bool? isRegistered,
        [FromQuery] int page,
        [FromQuery] int pageSize,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        try
        {
            var result = await mediator.Send(
                new ListAdminMembersQuery(currentMemberId.Value, search, role, isRegistered, page <= 0 ? 1 : page, pageSize <= 0 ? 25 : pageSize),
                cancellationToken);
            this.ApplyPrivateNoCacheHeaders();
            return this.ToActionResult(result);
        }
        catch (Exception ex)
        {
            this.ApplyPrivateNoCacheHeaders();
            return StatusCode(
                StatusCodes.Status500InternalServerError,
                new { message = $"Admin members query failed: {ex.GetBaseException().Message}" });
        }
    }

    [HttpGet("groups")]
    public async Task<IActionResult> ListGroups(
        [FromQuery] string? search,
        [FromQuery] int page,
        [FromQuery] int pageSize,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new ListAdminGroupsQuery(currentMemberId.Value, search, page <= 0 ? 1 : page, pageSize <= 0 ? 50 : pageSize),
            cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPut("members/{memberId:guid}/platform-role")]
    public async Task<IActionResult> SetMemberPlatformRole(
        Guid memberId,
        SetMemberPlatformRoleRequest request,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new SetMemberPlatformRoleCommand(currentMemberId.Value, memberId, request.RoleCode),
            cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpGet("audit-logs")]
    public async Task<IActionResult> ListAuditLogs(
        [FromQuery] string? search,
        [FromQuery] string? action,
        [FromQuery] string? entityType,
        [FromQuery] DateTime? fromUtc,
        [FromQuery] DateTime? toUtc,
        [FromQuery] int page,
        [FromQuery] int pageSize,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        try
        {
            var result = await mediator.Send(
                new ListAuditLogsQuery(currentMemberId.Value, search, action, entityType, fromUtc, toUtc, page <= 0 ? 1 : page, pageSize <= 0 ? 25 : pageSize),
                cancellationToken);
            this.ApplyPrivateNoCacheHeaders();
            return this.ToActionResult(result);
        }
        catch (Exception ex)
        {
            this.ApplyPrivateNoCacheHeaders();
            return StatusCode(
                StatusCodes.Status500InternalServerError,
                new { message = $"Audit logs query failed: {ex.GetBaseException().Message}" });
        }
    }

    [HttpGet("messages")]
    public async Task<IActionResult> ListMessages(
        [FromQuery] string? search,
        [FromQuery] string? actionType,
        [FromQuery] string? status,
        [FromQuery] int page,
        [FromQuery] int pageSize,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new ListAdminNotificationsQuery(currentMemberId.Value, search, actionType, status, page <= 0 ? 1 : page, pageSize <= 0 ? 25 : pageSize),
            cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("messages")]
    public async Task<IActionResult> SendMessage(SendAdminMessageRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new SendAdminMessageCommand(
                currentMemberId.Value,
                request.Scope,
                request.RecipientMemberId,
                request.GroupId,
                request.ActionType,
                request.TitleEn,
                request.TitleZh,
                request.BodyEn,
                request.BodyZh),
            cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("sermons/sync")]
    public async Task<IActionResult> SyncSermons(CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(new SyncSermonsCommand(currentMemberId.Value), cancellationToken);
        return this.ToActionResult(result);
    }

    [HttpPost("groups/{groupId:guid}/cloudflare-cache/refresh")]
    public async Task<IActionResult> RefreshCloudflareCache(Guid groupId, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new RefreshCloudflareCacheCommand(currentMemberId.Value, groupId),
            cancellationToken);
        return this.ToActionResult(result);
    }

    public sealed record SetMemberPlatformRoleRequest(string RoleCode);

    public sealed record SendAdminMessageRequest(
        string Scope,
        Guid? RecipientMemberId,
        Guid? GroupId,
        string ActionType,
        string TitleEn,
        string TitleZh,
        string BodyEn,
        string BodyZh);
}
