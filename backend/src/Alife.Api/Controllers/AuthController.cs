using Alife.Api.Security;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Auth.Commands.CreateDevAdminSession;
using Alife.Application.Auth.Commands.CreateGuestSession;
using Alife.Application.Auth.Commands.Login;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(
    IMediator mediator,
    ICurrentMemberAccessor currentMemberAccessor,
    IWebHostEnvironment environment) : ControllerBase
{
    [HttpPost("guest")]
    [AllowAnonymous]
    public async Task<IActionResult> Guest(CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new CreateGuestSessionCommand(), cancellationToken);
        if (!result.IsSuccess || result.Value is null)
        {
            return result.Status == Application.Common.Models.AppResultStatus.NotFound
                ? NotFound(new { message = result.Message })
                : BadRequest(new { message = result.Message });
        }

        AuthCookie.WriteCookie(Response, result.Value.Token, result.Value.ExpiresUtc, environment.IsDevelopment());
        return Ok(new { expiresUtc = result.Value.ExpiresUtc, isGuest = true });
    }

    [HttpPost("login")]
    [Authorize]
    public async Task<IActionResult> Login(CancellationToken cancellationToken)
    {
        var currentMemberId = currentMemberAccessor.GetCurrentMemberId();
        if (currentMemberId is null)
        {
            return Unauthorized();
        }

        var result = await mediator.Send(new LoginCommand(currentMemberId.Value), cancellationToken);
        if (!result.IsSuccess || result.Value is null)
        {
            return BadRequest(new { message = result.Message });
        }

        AuthCookie.WriteCookie(Response, result.Value.Token, result.Value.ExpiresUtc, environment.IsDevelopment());
        return Ok(new { expiresUtc = result.Value.ExpiresUtc, isGuest = false });
    }

    [HttpPost("logout")]
    [AllowAnonymous]
    public IActionResult Logout()
    {
        AuthCookie.ClearCookie(Response, environment.IsDevelopment());
        return Ok(new { ok = true });
    }

    [HttpPost("dev/admin")]
    [AllowAnonymous]
    public async Task<IActionResult> DevAdmin(CancellationToken cancellationToken)
    {
        var result = await mediator.Send(new CreateDevAdminSessionCommand(environment.IsDevelopment()), cancellationToken);
        if (!result.IsSuccess || result.Value is null)
        {
            return NotFound(new { message = result.Message });
        }

        AuthCookie.WriteCookie(Response, result.Value.Token, result.Value.ExpiresUtc, environment.IsDevelopment());
        return Ok(new { expiresUtc = result.Value.ExpiresUtc, isGuest = false, isAdmin = true });
    }
}
