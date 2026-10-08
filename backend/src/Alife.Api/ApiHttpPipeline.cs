using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;

namespace Alife.Api;

internal sealed class ApiHttpPipeline
{
    private readonly RequestDelegate _pipeline;

    public ApiHttpPipeline(IServiceProvider serviceProvider)
    {
        var app = new ApplicationBuilder(serviceProvider);

        app.UseRouting();
        // Apply before authorization/model binding so denied or invalid private
        // requests have the same no-storage policy as controller responses.
        app.Use(async (context, next) =>
        {
            var segments = context.Request.Path.Value?.Split('/', StringSplitOptions.RemoveEmptyEntries) ?? [];
            var isRam = segments.Length >= 4 && segments[0] == "api" && segments[1] == "events" && segments[3] == "ram";
            var isPolicy = segments.Length >= 5 && segments[0] == "api" && segments[1] == "admin" && segments[2] == "churches" && segments[4] == "ram-policies";
            var isBibleReadingProgress = string.Equals(
                context.Request.Path.Value?.TrimEnd('/'),
                "/api/me/bible-reading-progress", StringComparison.OrdinalIgnoreCase);
            if (isRam || isPolicy || isBibleReadingProgress)
            {
                context.Response.Headers.CacheControl = "private, no-store";
                context.Response.Headers.Pragma = "no-cache";
                context.Response.Headers.Append("Vary", "Cookie, Authorization");
            }
            await next(context);
        });
        app.UseSwagger(options =>
        {
            options.RouteTemplate = "api/swagger/{documentName}/swagger.json";
        });
        app.UseSwaggerUI(options =>
        {
            options.SwaggerEndpoint("/api/swagger/v1/swagger.json", "Alife API v1");
            options.RoutePrefix = "api/help";
        });
        app.UseCors("Frontend");
        app.UseAuthentication();
        app.UseAuthorization();

        app.UseEndpoints(endpoints =>
        {
            endpoints.MapControllers();
        });

        _pipeline = app.Build();
    }

    public Task InvokeAsync(HttpContext httpContext)
        => _pipeline(httpContext);
}
