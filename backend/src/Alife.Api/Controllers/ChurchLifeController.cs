using Alife.Api.Http;
using Alife.Api.Results;
using Alife.Application.Abstractions.Identity;
using Alife.Application.ChurchLife;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/church-life")]
public sealed class ChurchLifeController(
    IChurchLifeService churchLife,
    ICurrentMemberAccessor currentMemberAccessor) : ControllerBase
{
    [HttpGet("pages")]
    public async Task<IActionResult> Pages([FromQuery] Guid? ownerGroupId, CancellationToken cancellationToken)
        => await ExecuteAsync(
            (memberId, token) => churchLife.ListPagesAsync(memberId, ownerGroupId, token),
            cancellationToken);

    [HttpGet("events")]
    public async Task<IActionResult> Events([FromQuery] Guid? ownerGroupId, CancellationToken cancellationToken)
        => await ExecuteAsync(
            (memberId, token) => churchLife.ListEventsAsync(memberId, ownerGroupId, token),
            cancellationToken);

    [HttpGet("announcements")]
    public async Task<IActionResult> Announcements([FromQuery] Guid? ownerGroupId, CancellationToken cancellationToken)
        => await ExecuteAsync(
            (memberId, token) => churchLife.ListAnnouncementsAsync(memberId, ownerGroupId, token),
            cancellationToken);

    [HttpGet("albums")]
    public async Task<IActionResult> Albums([FromQuery] Guid? ownerGroupId, CancellationToken cancellationToken)
        => await ExecuteAsync(
            (memberId, token) => churchLife.ListAlbumsAsync(memberId, ownerGroupId, token),
            cancellationToken);

    [HttpGet("forum/posts")]
    public async Task<IActionResult> ForumPosts(
        [FromQuery] Guid? ownerGroupId,
        [FromQuery] Guid? categoryId,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
        => await ExecuteAsync(
            (memberId, token) => churchLife.ListForumPostsAsync(
                memberId,
                ownerGroupId,
                categoryId,
                page,
                pageSize,
                token),
            cancellationToken);

    private async Task<IActionResult> ExecuteAsync<T>(
        Func<Guid, CancellationToken, Task<Alife.Application.Common.Models.AppResult<T>>> action,
        CancellationToken cancellationToken)
    {
        var memberId = currentMemberAccessor.GetCurrentMemberId();
        if (!memberId.HasValue)
        {
            return Unauthorized();
        }

        var result = await action(memberId.Value, cancellationToken);
        this.ApplyPrivateNoCacheHeaders();
        return this.ToActionResult(result);
    }
}
