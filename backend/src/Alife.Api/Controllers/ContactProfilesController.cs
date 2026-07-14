using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Contacts.Commands.CreateContactInquiry;
using Alife.Application.Contacts.Commands.CreateContactProfile;
using Alife.Application.Contacts.Commands.DeleteContactProfile;
using Alife.Application.Contacts.Commands.UpdateContactProfile;
using Alife.Application.Contacts.Queries.GetGroupContactProfiles;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api")]
[Authorize]
public sealed class ContactProfilesController(IMediator mediator, ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
    [HttpGet("groups/{groupId:guid}/contacts")]
    [AllowAnonymous]
    public async Task<IActionResult> List(Guid groupId, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(
            new GetGroupContactProfilesQuery(groupId, currentMemberAccessor.GetCurrentMemberId()), cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }

    [HttpPost("groups/{groupId:guid}/contacts")]
    public async Task<IActionResult> Create(Guid groupId, ContactProfileRequest request, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (memberId is null) return Unauthorized();

        var result = await mediator.Send(new CreateContactProfileCommand(
            groupId, memberId.Value, request.MemberId, request.Name, request.Role, request.PhotoUrl,
            request.Notes, request.Phone, request.Email, request.Visibility), cancellationToken);
        return result.IsSuccess ? StatusCode(StatusCodes.Status201Created, result.Value) : this.ToActionResult(result);
    }

    [HttpPut("contact-profiles/{id:guid}")]
    public async Task<IActionResult> Update(Guid id, ContactProfileRequest request, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (memberId is null) return Unauthorized();

        var result = await mediator.Send(new UpdateContactProfileCommand(
            id, memberId.Value, request.MemberId, request.Name, request.Role, request.PhotoUrl,
            request.Notes, request.Phone, request.Email, request.Visibility), cancellationToken);
        return this.ToActionResult(result);
    }

    [HttpDelete("contact-profiles/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (memberId is null) return Unauthorized();
        return this.ToActionResult(await mediator.Send(new DeleteContactProfileCommand(id, memberId.Value), cancellationToken));
    }

    [HttpPost("contact-profiles/{id:guid}/inquiries")]
    [AllowAnonymous]
    public async Task<IActionResult> CreateInquiry(Guid id, ContactInquiryRequest request, CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new CreateContactInquiryCommand(
            id,
            currentMemberAccessor.GetCurrentMemberId(),
            request.DisplayName,
            request.Email,
            request.Phone,
            request.Message,
            request.PreferredLanguage,
            request.SourcePage,
            HttpContext.Connection.RemoteIpAddress?.ToString(),
            Request.Headers.UserAgent.ToString()), cancellationToken);
        return result.IsSuccess ? StatusCode(StatusCodes.Status201Created, result.Value) : this.ToActionResult(result);
    }

    public sealed record ContactProfileRequest(
        Guid MemberId,
        IReadOnlyDictionary<string, string> Name,
        IReadOnlyDictionary<string, string> Role,
        string? PhotoUrl,
        IReadOnlyDictionary<string, string>? Notes,
        string? Phone,
        string? Email,
        string Visibility);

    public sealed record ContactInquiryRequest(
        string DisplayName,
        string? Email,
        string? Phone,
        string Message,
        string? PreferredLanguage,
        string? SourcePage);
}
