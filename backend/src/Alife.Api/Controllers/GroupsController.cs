using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Groups.Commands.AcceptGroupInvite;
using Alife.Application.Groups.Commands.ApproveGroupMember;
using Alife.Application.Groups.Commands.ClaimSubgroupCoLeader;
using Alife.Application.Groups.Commands.CloseGroup;
using Alife.Application.Groups.Commands.CreateSubgroup;
using Alife.Application.Groups.Commands.DeclineGroupInvite;
using Alife.Application.Groups.Commands.InviteGroupMember;
using Alife.Application.Groups.Commands.InviteGroupMemberById;
using Alife.Application.Groups.Commands.JoinGroup;
using Alife.Application.Groups.Commands.KickGroupMember;
using Alife.Application.Groups.Commands.RejectGroupMember;
using Alife.Application.Groups.Commands.SetGroupCoLeader;
using Alife.Application.Groups.Commands.UpdateGroup;
using Alife.Application.Groups.Queries.GetChurch;
using Alife.Application.Groups.Queries.GetGroupById;
using Alife.Application.Groups.Queries.GetGroupInviteCandidates;
using Alife.Application.Groups.Queries.GetGroupMemberships;
using Alife.Application.Groups.Queries.GetSubgroups;
using Alife.Domain.Enums;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api/groups")]
[Authorize]
public class GroupsController(
    IMediator mediator,
    ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
    [HttpGet("church")]
    [AllowAnonymous]
    public async Task<IActionResult> GetChurch(CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new GetChurchQuery(), cancellationToken);
        if (!result.IsSuccess)
        {
            return this.ToActionResult(result);
        }

        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpGet("{id:guid}")]
    [AllowAnonymous]
    public async Task<IActionResult> GetById(Guid id, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();

        var result = await mediator.Send(new GetGroupByIdQuery(id, currentMemberId), cancellationToken);
        if (!result.IsSuccess)
        {
            return this.ToActionResult(result);
        }

        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpGet("{id:guid}/subgroups")]
    public async Task<IActionResult> GetSubgroups(Guid id, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(new GetSubgroupsQuery(id, currentMemberId.Value), cancellationToken);
        if (!result.IsSuccess)
        {
            return this.ToActionResult(result);
        }

        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("{id:guid}/subgroups")]
    public async Task<IActionResult> CreateSubgroup(Guid id, [FromBody] CreateSubgroupRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new CreateSubgroupCommand(id, currentMemberId.Value, request.Name, request.Description, request.AccessType),
            cancellationToken);

        return this.ToActionResult(result);
    }

    [HttpPost("{id:guid}/subgroups/{subgroupId:guid}/claim-coleader")]
    public async Task<IActionResult> ClaimSubgroupCoLeader(Guid id, Guid subgroupId, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new ClaimSubgroupCoLeaderCommand(id, subgroupId, currentMemberId.Value),
            cancellationToken);

        return this.ToActionResult(result);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> UpdateGroup(Guid id, [FromBody] UpdateGroupRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new UpdateGroupCommand(id, currentMemberId.Value, request.Name, request.Description, request.AccessType, request.IsClosed),
            cancellationToken);

        return this.ToActionResult(result);
    }

    [HttpPost("{id:guid}/close")]
    public async Task<IActionResult> CloseGroup(Guid id, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(new CloseGroupCommand(id, currentMemberId.Value), cancellationToken);
        return this.ToActionResult(result);
    }

    [HttpGet("{id:guid}/memberships")]
    public async Task<IActionResult> GetMemberships(
        Guid id,
        [FromQuery] bool includeLineCandidates,
        CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new GetGroupMembershipsQuery(id, currentMemberId.Value, includeLineCandidates),
            cancellationToken);
        if (!result.IsSuccess)
        {
            return this.ToActionResult(result);
        }

        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpGet("{id:guid}/invite-candidates")]
    public async Task<IActionResult> GetInviteCandidates(Guid id, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new GetGroupInviteCandidatesQuery(id, currentMemberId.Value),
            cancellationToken);
        if (!result.IsSuccess)
        {
            return this.ToActionResult(result);
        }

        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("{id:guid}/join-request")]
    public async Task<IActionResult> JoinRequest(Guid id, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(new JoinGroupCommand(id, currentMemberId.Value), cancellationToken);
        return this.ToActionResult(result);
    }

    [HttpPost("{id:guid}/invite")]
    public async Task<IActionResult> Invite(Guid id, [FromBody] InviteRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new InviteGroupMemberCommand(id, currentMemberId.Value, request.TargetPhoneE164),
            cancellationToken);

        return this.ToActionResult(result);
    }

    [HttpPost("{id:guid}/invite-by-id")]
    public async Task<IActionResult> InviteById(Guid id, [FromBody] InviteByIdRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new InviteGroupMemberByIdCommand(id, currentMemberId.Value, request.TargetMemberId),
            cancellationToken);

        return this.ToActionResult(result);
    }

    [HttpPost("{id:guid}/invite/accept")]
    public async Task<IActionResult> AcceptInvite(Guid id, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(new AcceptGroupInviteCommand(id, currentMemberId.Value), cancellationToken);
        return this.ToActionResult(result);
    }

    [HttpPost("{id:guid}/invite/decline")]
    public async Task<IActionResult> DeclineInvite(Guid id, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(new DeclineGroupInviteCommand(id, currentMemberId.Value), cancellationToken);
        return this.ToActionResult(result);
    }

    [HttpPost("{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] MemberTargetRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new ApproveGroupMemberCommand(id, currentMemberId.Value, request.MemberId),
            cancellationToken);

        return this.ToActionResult(result);
    }

    [HttpPost("{id:guid}/reject")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] MemberTargetRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new RejectGroupMemberCommand(id, currentMemberId.Value, request.MemberId),
            cancellationToken);

        return this.ToActionResult(result);
    }

    [HttpPost("{id:guid}/set-coleader")]
    public async Task<IActionResult> SetCoLeader(Guid id, [FromBody] SetCoLeaderRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new SetGroupCoLeaderCommand(id, currentMemberId.Value, request.MemberId, request.IsCoLeader),
            cancellationToken);

        return this.ToActionResult(result);
    }

    [HttpPost("{id:guid}/kick")]
    public async Task<IActionResult> Kick(Guid id, [FromBody] MemberTargetRequest request, CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(
            new KickGroupMemberCommand(id, currentMemberId.Value, request.MemberId),
            cancellationToken);

        return this.ToActionResult(result);
    }
    public record CreateSubgroupRequest(
        IReadOnlyDictionary<string, string> Name,
        IReadOnlyDictionary<string, string>? Description,
        AccessType AccessType);
    public record UpdateGroupRequest(
        IReadOnlyDictionary<string, string> Name,
        IReadOnlyDictionary<string, string>? Description,
        AccessType AccessType,
        bool IsClosed);
    public record InviteRequest(string TargetPhoneE164);
    public record InviteByIdRequest(Guid TargetMemberId);
    public record MemberTargetRequest(Guid MemberId);
    public record SetCoLeaderRequest(Guid MemberId, bool IsCoLeader);
}
