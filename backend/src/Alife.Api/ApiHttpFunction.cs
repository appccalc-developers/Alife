using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Azure.Functions.Worker;

namespace Alife.Api;

internal sealed class ApiHttpFunction(ApiHttpPipeline pipeline)
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
        await pipeline.InvokeAsync(request.HttpContext);
        return new EmptyResult();
    }
}
