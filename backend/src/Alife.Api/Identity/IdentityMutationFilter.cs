using Alife.Api.Http;
using Alife.Application.IdentityAccess;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Alife.Api.Identity;

public sealed class IdentityMutationFilter(IConfiguration configuration, IServerRateLimiter limiter) : IAsyncActionFilter
{
    public async Task OnActionExecutionAsync(ActionExecutingContext context, ActionExecutionDelegate next)
    {
        if (HttpMethods.IsGet(context.HttpContext.Request.Method)) { await next(); return; }
        context.HttpContext.Response.Headers.CacheControl = "private, no-store";
        if (!IdentityHttp.IsTrustedBrowserOrigin(context.HttpContext.Request, configuration))
        {
            context.Result = new ObjectResult(new { code = "identity_origin_invalid" }) { StatusCode = 403 };
            return;
        }
        var decision = await limiter.TryConsumeAsync("identity-management-mutations", IdentityHttp.GetClientRateLimitKey(context.HttpContext.Request, configuration),
            60, TimeSpan.FromMinutes(1), context.HttpContext.RequestAborted);
        if (!decision.Allowed)
        {
            context.Result = new ObjectResult(new { code = "identity_rate_limited" }) { StatusCode = 429 };
            return;
        }
        await next();
    }
}
