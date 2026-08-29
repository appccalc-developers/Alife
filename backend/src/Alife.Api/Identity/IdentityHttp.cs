using System.Net;
using System.Net.Sockets;
using Alife.Application.Common.Models;
using Alife.Application.IdentityAccess;
using Microsoft.AspNetCore.Mvc;

namespace Alife.Api.Identity;

public static class IdentityHttp
{
    public static IActionResult ToIdentityResult<T>(this ControllerBase controller, AppResult<T> result)
    {
        if (result.IsSuccess)
        {
            return controller.Ok(result.Value);
        }

        var status = result.Status switch
        {
            AppResultStatus.NotFound => StatusCodes.Status404NotFound,
            AppResultStatus.Forbidden => StatusCodes.Status403Forbidden,
            AppResultStatus.ValidationError => StatusCodes.Status400BadRequest,
            AppResultStatus.Conflict => StatusCodes.Status409Conflict,
            AppResultStatus.PreconditionFailed => StatusCodes.Status412PreconditionFailed,
            _ => StatusCodes.Status500InternalServerError
        };
        return controller.StatusCode(status, new ProblemDetails
        {
            Status = status,
            Title = "The identity request could not be completed.",
            Extensions = { ["code"] = result.Message ?? "identity_request_failed" }
        });
    }

    public static string GetClientRateLimitKey(HttpRequest request, IConfiguration configuration)
    {
        var remote = request.HttpContext.Connection.RemoteIpAddress;
        var trusted = remote is not null && (configuration
            .GetSection("TrustedProxyNetworks")
            .Get<string[]>()
            ?.Any(value => IsInNetwork(remote, value)) == true);

        if (trusted && request.Headers.TryGetValue("CF-Connecting-IP", out var values))
        {
            var candidate = values.FirstOrDefault()?.Trim();
            if (IPAddress.TryParse(candidate, out var forwarded))
            {
                return forwarded.ToString();
            }
        }

        return remote?.ToString() ?? "unknown";
    }

    public static IActionResult RateLimited(this ControllerBase controller, RateLimitDecision decision)
    {
        var seconds = Math.Max(1, (int)Math.Ceiling((decision.RetryAfterUtc - DateTime.UtcNow).TotalSeconds));
        controller.Response.Headers.RetryAfter = seconds.ToString();
        return controller.StatusCode(StatusCodes.Status429TooManyRequests, new ProblemDetails
        {
            Status = StatusCodes.Status429TooManyRequests,
            Title = "Too many requests.",
            Extensions = { ["code"] = "rate_limited" }
        });
    }

    private static bool IsInNetwork(IPAddress address, string value)
    {
        var parts = value.Trim().Split('/', 2);
        if (!IPAddress.TryParse(parts[0], out var network) || network.AddressFamily != address.AddressFamily)
        {
            return false;
        }
        if (parts.Length == 1)
        {
            return network.Equals(address);
        }
        if (!int.TryParse(parts[1], out var prefix))
        {
            return false;
        }

        var networkBytes = network.GetAddressBytes();
        var addressBytes = address.GetAddressBytes();
        if (prefix < 0 || prefix > networkBytes.Length * 8) return false;
        var fullBytes = prefix / 8;
        var remaining = prefix % 8;
        for (var index = 0; index < fullBytes; index++)
        {
            if (networkBytes[index] != addressBytes[index]) return false;
        }
        if (remaining == 0) return true;
        var mask = (byte)(0xff << (8 - remaining));
        return (networkBytes[fullBytes] & mask) == (addressBytes[fullBytes] & mask);
    }
}
