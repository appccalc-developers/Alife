using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Admin.Commands.ApprovePagePublication;
using Alife.Application.Admin.Commands.BackfillMemberPrivateFiles;
using Alife.Application.Admin.Commands.CreatePlatformRole;
using Alife.Application.Admin.Commands.CreatePagePrimaryMenu;
using Alife.Application.Admin.Commands.DeletePlatformRole;
using Alife.Application.Admin.Commands.DeletePagePrimaryMenu;
using Alife.Application.Admin.Commands.RefreshCloudflareCache;
using Alife.Application.Admin.Commands.ReturnPagePublication;
using Alife.Application.Admin.Commands.SendAdminMessage;
using Alife.Application.Admin.Commands.SavePageMenuLayout;
using Alife.Application.Admin.Commands.SetMemberPlatformRole;
using Alife.Application.Admin.Commands.UpdateMemberProfile;
using Alife.Application.Admin.Commands.UpdatePagePrimaryMenu;
using Alife.Application.Admin.Commands.SyncSermons;
using Alife.Application.Admin.Commands.UpdatePlatformRolePermissions;
using Alife.Application.Admin.Queries.GetAdminSelfDiagnostic;
using Alife.Application.Admin.Queries.ListAdminGroups;
using Alife.Application.Admin.Queries.ListAdminMembers;
using Alife.Application.Admin.Queries.ListAdminNotifications;
using Alife.Application.Admin.Queries.ListPageReviewCandidates;
using Alife.Application.Admin.Queries.ListPagePrimaryMenus;
using Alife.Domain.Enums;
using Alife.Application.Admin.Dtos;
using Alife.Application.Admin.Queries.ListAuditLogs;
using Alife.Application.Admin.Queries.ListPlatformRoles;
using Alife.Application.VisitContactRequests.Commands.UpdateVisitContactRequestStatus;
using Alife.Application.VisitContactRequests.Queries.ListVisitContactRequests;
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

    [HttpGet("pages/review-candidates")]
    public async Task<IActionResult> ListPageReviewCandidates(CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(new ListPageReviewCandidatesQuery(currentMemberId.Value), cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("pages/{pageId:guid}/publication-review/approve")]
    public async Task<IActionResult> ApprovePagePublicationReview(
        Guid pageId,
        [FromBody] ApprovePagePublicationReviewRequest? request,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new ApprovePagePublicationCommand(
                currentMemberId.Value,
                pageId,
                request?.PrimaryMenuName,
                request?.AccessName,
                request?.CardImageUrl,
                request?.CardText),
            cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpGet("page-primary-menus")]
    public async Task<IActionResult> ListPagePrimaryMenus(CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(new ListPagePrimaryMenusQuery(currentMemberId.Value), cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("page-primary-menus")]
    public async Task<IActionResult> CreatePagePrimaryMenu(
        CreatePagePrimaryMenuRequest request,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new CreatePagePrimaryMenuCommand(currentMemberId.Value, request.Name, request.HomePlacement),
            cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPut("page-primary-menus/{primaryMenuId:guid}")]
    public async Task<IActionResult> UpdatePagePrimaryMenu(
        Guid primaryMenuId,
        UpdatePagePrimaryMenuRequest request,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new UpdatePagePrimaryMenuCommand(currentMemberId.Value, primaryMenuId, request.Name, request.HomePlacement),
            cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpDelete("page-primary-menus/{primaryMenuId:guid}")]
    public async Task<IActionResult> DeletePagePrimaryMenu(Guid primaryMenuId, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new DeletePagePrimaryMenuCommand(currentMemberId.Value, primaryMenuId),
            cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPut("page-primary-menus/layout")]
    public async Task<IActionResult> SavePageMenuLayout(
        SavePageMenuLayoutRequest request,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new SavePageMenuLayoutCommand(currentMemberId.Value, request.Menus ?? []),
            cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("pages/{pageId:guid}/publication-review/return")]
    public async Task<IActionResult> ReturnPagePublicationReview(
        Guid pageId,
        ReturnPagePublicationReviewRequest request,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(new ReturnPagePublicationCommand(currentMemberId.Value, pageId, request.Reason), cancellationToken);
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

        try
        {
            var result = await mediator.Send(
                new SetMemberPlatformRoleCommand(
                    currentMemberId.Value,
                    memberId,
                    request.RoleCodes is { Count: > 0 } ? request.RoleCodes : [request.RoleCode ?? "user"]),
                cancellationToken);
            this.ApplyPrivateNoCacheHeaders();
            return this.ToActionResult(result);
        }
        catch (Exception ex)
        {
            this.ApplyPrivateNoCacheHeaders();
            return StatusCode(
                StatusCodes.Status500InternalServerError,
                new { message = $"Platform role update failed: {ex.GetBaseException().Message}" });
        }
    }

    [HttpPut("members/{memberId:guid}/profile")]
    public async Task<IActionResult> UpdateMemberProfile(
        Guid memberId,
        UpdateMemberProfileRequest request,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new UpdateMemberProfileCommand(
                currentMemberId.Value,
                memberId,
                request.DisplayName,
                request.Email,
                request.PhoneE164),
            cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("platform-roles")]
    public async Task<IActionResult> CreatePlatformRole(CreatePlatformRoleRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new CreatePlatformRoleCommand(
                currentMemberId.Value,
                request.Code,
                request.NameEn,
                request.NameZh,
                request.PermissionCodes),
            cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPut("platform-roles/{roleId:int}/permissions")]
    public async Task<IActionResult> UpdatePlatformRolePermissions(
        int roleId,
        UpdatePlatformRolePermissionsRequest request,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new UpdatePlatformRolePermissionsCommand(currentMemberId.Value, roleId, request.PermissionCodes),
            cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpDelete("platform-roles/{roleId:int}")]
    public async Task<IActionResult> DeletePlatformRole(int roleId, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(new DeletePlatformRoleCommand(currentMemberId.Value, roleId), cancellationToken);
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

    [HttpGet("visit-contact-requests")]
    public async Task<IActionResult> ListVisitContactRequests(
        [FromQuery] string? search,
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
            new ListVisitContactRequestsQuery(currentMemberId.Value, search, status, page <= 0 ? 1 : page, pageSize <= 0 ? 25 : pageSize),
            cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPut("visit-contact-requests/{requestId:guid}/status")]
    public async Task<IActionResult> UpdateVisitContactRequestStatus(
        Guid requestId,
        UpdateVisitContactRequestStatusRequest request,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new UpdateVisitContactRequestStatusCommand(currentMemberId.Value, requestId, request.Status),
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
                request.RoleCodes ?? [],
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

    [HttpPost("file-assets/member-private/backfill")]
    public async Task<IActionResult> BackfillMemberPrivateFiles(
        BackfillMemberPrivateFilesRequest request,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new BackfillMemberPrivateFilesCommand(
                currentMemberId.Value,
                request.DryRun ?? true,
                request.MaxItems ?? 50),
            cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    public sealed record SetMemberPlatformRoleRequest(string? RoleCode, IReadOnlyList<string>? RoleCodes);
    public sealed record UpdateMemberProfileRequest(string? DisplayName, string? Email, string? PhoneE164);

    public sealed record CreatePlatformRoleRequest(
        string Code,
        string NameEn,
        string NameZh,
        IReadOnlyList<string> PermissionCodes);

    public sealed record UpdatePlatformRolePermissionsRequest(IReadOnlyList<string> PermissionCodes);
    public sealed record UpdateVisitContactRequestStatusRequest(string Status);
    public sealed record ApprovePagePublicationReviewRequest(
        IReadOnlyDictionary<string, string>? PrimaryMenuName,
        IReadOnlyDictionary<string, string>? AccessName,
        string? CardImageUrl,
        IReadOnlyDictionary<string, string>? CardText);
    public sealed record UpdatePagePrimaryMenuRequest(
        IReadOnlyDictionary<string, string>? Name,
        PagePrimaryMenuHomePlacement? HomePlacement);
    public sealed record CreatePagePrimaryMenuRequest(
        IReadOnlyDictionary<string, string>? Name,
        PagePrimaryMenuHomePlacement? HomePlacement);
    public sealed record SavePageMenuLayoutRequest(IReadOnlyList<PagePrimaryMenuLayoutItemDto>? Menus);
    public sealed record ReturnPagePublicationReviewRequest(string Reason);

    public sealed record SendAdminMessageRequest(
        string Scope,
        Guid? RecipientMemberId,
        Guid? GroupId,
        IReadOnlyList<string>? RoleCodes,
        string ActionType,
        string TitleEn,
        string TitleZh,
        string BodyEn,
        string BodyZh);

    public sealed record BackfillMemberPrivateFilesRequest(bool? DryRun, int? MaxItems);
}
