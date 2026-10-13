using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.DependencyInjection;

namespace Alife.Api;

internal sealed class ApiHttpPipeline
{
    private readonly RequestDelegate _pipeline;

    public ApiHttpPipeline(IServiceProvider serviceProvider)
    {
        var app = new ApplicationBuilder(serviceProvider);

        app.UseRouting();
        var eventFreeze = serviceProvider.GetRequiredService<EventWriteFreezeState>();
        // Apply before authorization/model binding so denied or invalid RAM requests
        // have the same privacy policy as successful controller responses.
        app.Use(async (context, next) =>
        {
            var segments = context.Request.Path.Value?.Split('/', StringSplitOptions.RemoveEmptyEntries) ?? [];
            var isRam = segments.Length >= 4 && segments[0] == "api" && segments[1] == "events" && segments[3] == "ram";
            var isPolicy = segments.Length >= 5 && segments[0] == "api" && segments[1] == "admin" && segments[2] == "churches" && segments[4] == "ram-policies";
            if (isRam || isPolicy)
            {
                context.Response.Headers.CacheControl = "private, no-store";
                context.Response.Headers.Pragma = "no-cache";
                context.Response.Headers.Append("Vary", "Cookie, Authorization");
            }
            await next(context);
        });
        app.Use(async (context, next) =>
        {
            if (!EventWriteFreezeState.IsEventMutation(context.Request))
            {
                await next(context);
                return;
            }

            using var mutation = eventFreeze.TryEnterMutation();
            if (mutation is not null)
            {
                await next(context);
                return;
            }

            var status = eventFreeze.GetStatus();
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            context.Response.Headers.CacheControl = "no-store";
            context.Response.Headers.RetryAfter = status.RetryAfterSeconds.ToString(System.Globalization.CultureInfo.InvariantCulture);
            if (status.ResetEpoch is not null)
                context.Response.Headers["X-Alife-Event-Reset-Epoch"] = status.ResetEpoch;
            if (status.SchemaEpoch is not null)
                context.Response.Headers["X-Alife-Event-Schema-Epoch"] = status.SchemaEpoch;
            await context.Response.WriteAsJsonAsync(new
            {
                code = status.ConfigurationValid ? "event.reset.frozen" : "event.reset.configuration",
                message = status.ConfigurationValid
                    ? "Event changes are temporarily unavailable while Event data maintenance is in progress."
                    : "Event changes are unavailable because the production Event runtime epoch is not configured.",
                frozen = true,
                epoch = status.Epoch,
                resetEpoch = status.ResetEpoch,
                schemaVersion = status.SchemaVersion,
                schemaEpoch = status.SchemaEpoch
            });
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
