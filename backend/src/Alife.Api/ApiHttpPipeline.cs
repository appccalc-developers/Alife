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
        app.UseSwagger();
        app.UseSwaggerUI(options =>
        {
            options.SwaggerEndpoint("/swagger/v1/swagger.json", "Alife API v1");
            options.RoutePrefix = "swagger";
        });
        app.UseCors("Frontend");
        app.UseAuthentication();
        app.UseAuthorization();

        app.UseEndpoints(endpoints =>
        {
            endpoints.MapGet("/", context =>
            {
                context.Response.Redirect("/swagger");
                return Task.CompletedTask;
            });
            ApiHealthCheckSetup.MapEndpoints(endpoints);
            endpoints.MapControllers();
        });

        _pipeline = app.Build();
    }

    public Task InvokeAsync(HttpContext httpContext)
        => _pipeline(httpContext);
}
