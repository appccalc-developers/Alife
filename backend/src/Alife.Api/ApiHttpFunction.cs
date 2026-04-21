using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;

namespace Alife.Api;

internal sealed class ApiHttpFunction(ApiHttpPipeline pipeline, IHttpContextAccessor httpContextAccessor)
{
    [Function("ApiHttpFunction")]
    public async Task<IActionResult> Run(
        [HttpTrigger(
            AuthorizationLevel.Anonymous,
            "get",
            "post",
            "put",
            "delete",
            "patch",
            "head",
            "options",
            Route = "{*path}")]
        HttpRequest request)
    {
        request.HttpContext.SetEndpoint(null);
        request.HttpContext.Request.RouteValues.Clear();
        var previousHttpContext = httpContextAccessor.HttpContext;
        httpContextAccessor.HttpContext = request.HttpContext;

        try
        {
            await pipeline.InvokeAsync(request.HttpContext);
        }
        finally
        {
            httpContextAccessor.HttpContext = previousHttpContext;
        }

        return new EmptyResult();
    }
}
