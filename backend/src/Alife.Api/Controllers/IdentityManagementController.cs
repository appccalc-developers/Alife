using Alife.Api.Http;
using Alife.Api.Identity;
using Alife.Application.Abstractions.Identity;
using Alife.Application.IdentityAccess;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Authorize]
public sealed class IdentityManagementController(
    IIdentityAccessService identityAccess,
    ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
    [HttpGet("api/admin/member-activations")]
    public async Task<IActionResult> ListActivations(CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var actor = currentMemberAccessor.GetCurrentMemberId();
        return actor is null
            ? Unauthorized()
            : this.ToIdentityResult(await identityAccess.ListActivationsAsync(actor.Value, cancellationToken));
    }

    [HttpPost("api/admin/member-activations")]
    public async Task<IActionResult> CreateActivation(
        CreateActivationRequest request,
        CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var actor = currentMemberAccessor.GetCurrentMemberId();
        if (actor is null) return Unauthorized();
        var result = await identityAccess.CreateActivationAsync(actor.Value, request, cancellationToken);
        return result.IsSuccess
            ? StatusCode(StatusCodes.Status201Created, result.Value)
            : this.ToIdentityResult(result);
    }

    [HttpPost("api/admin/member-activations/{activationId:guid}/revoke")]
    public async Task<IActionResult> RevokeActivation(Guid activationId, CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var actor = currentMemberAccessor.GetCurrentMemberId();
        return actor is null
            ? Unauthorized()
            : this.ToIdentityResult(await identityAccess.RevokeActivationAsync(actor.Value, activationId, cancellationToken));
    }

    [HttpPost("api/admin/member-activations/{activationId:guid}/resend")]
    public async Task<IActionResult> ResendActivation(Guid activationId, CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var actor = currentMemberAccessor.GetCurrentMemberId();
        return actor is null
            ? Unauthorized()
            : this.ToIdentityResult(await identityAccess.ResendActivationAsync(actor.Value, activationId, cancellationToken));
    }

    [HttpPost("api/groups/{groupId:guid}/join-invite")]
    public async Task<IActionResult> GenerateJoinInvite(Guid groupId, CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var actor = currentMemberAccessor.GetCurrentMemberId();
        return actor is null
            ? Unauthorized()
            : this.ToIdentityResult(await identityAccess.GetOrCreateGroupInviteAsync(actor.Value, groupId, cancellationToken));
    }

    [HttpGet("api/groups/{groupId:guid}/join-invite")]
    public async Task<IActionResult> GetJoinInvite(Guid groupId, CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var actor = currentMemberAccessor.GetCurrentMemberId();
        return actor is null
            ? Unauthorized()
            : this.ToIdentityResult(await identityAccess.GetGroupInviteAsync(actor.Value, groupId, cancellationToken));
    }

    [HttpPost("api/groups/{groupId:guid}/join-invite/{action}")]
    public async Task<IActionResult> ChangeJoinInvite(
        Guid groupId,
        string action,
        CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var actor = currentMemberAccessor.GetCurrentMemberId();
        return actor is null
            ? Unauthorized()
            : this.ToIdentityResult(await identityAccess.ChangeGroupInviteStatusAsync(actor.Value, groupId, action, cancellationToken));
    }

    [HttpGet("api/groups/{groupId:guid}/membership-applications")]
    public async Task<IActionResult> ListApplications(
        Guid groupId,
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] string? sort,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        this.ApplyPrivateNoStoreHeaders();
        var actor = currentMemberAccessor.GetCurrentMemberId();
        return actor is null
            ? Unauthorized()
            : this.ToIdentityResult(await identityAccess.ListGroupApplicationsAsync(
                actor.Value, groupId, status, search, sort, page, pageSize, cancellationToken));
    }

    [HttpPost("api/groups/{groupId:guid}/membership-applications/{applicationId:guid}/decisions")]
    public async Task<IActionResult> DecideGroupApplication(
        Guid groupId,
        Guid applicationId,
        DecideMembershipApplicationRequest request,
        CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var actor = currentMemberAccessor.GetCurrentMemberId();
        return actor is null
            ? Unauthorized()
            : this.ToIdentityResult(await identityAccess.DecideGroupApplicationAsync(
                actor.Value, groupId, applicationId, request, cancellationToken));
    }

    [HttpPost("api/admin/person-applications/{applicationId:guid}/decisions")]
    public async Task<IActionResult> DecidePersonApplication(
        Guid applicationId,
        DecideMembershipApplicationRequest request,
        CancellationToken cancellationToken)
    {
        this.ApplyPrivateNoStoreHeaders();
        var actor = currentMemberAccessor.GetCurrentMemberId();
        return actor is null
            ? Unauthorized()
            : this.ToIdentityResult(await identityAccess.DecidePersonApplicationAsync(
                actor.Value, applicationId, request, cancellationToken));
    }

    [HttpGet("api/admin/person-applications")]
    public async Task<IActionResult> ListPersonApplications(
        [FromQuery] string? status,
        [FromQuery] string? search,
        [FromQuery] string? sort,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        this.ApplyPrivateNoStoreHeaders();
        var actor = currentMemberAccessor.GetCurrentMemberId();
        return actor is null
            ? Unauthorized()
            : this.ToIdentityResult(await identityAccess.ListPersonApplicationsAsync(
                actor.Value, status, search, sort, page, pageSize, cancellationToken));
    }
}
