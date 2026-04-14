using System.Text;
using Alife.Api;
using Alife.Api.Security;
using Alife.Application;
using Alife.Application.Abstractions.Identity;
using Alife.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddHybridCache();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentMemberAccessor, CurrentMemberAccessor>();
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();
builder.Services.AddProblemDetails();
ApiHealthCheckSetup.ConfigureServices(builder.Services);

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
        policy.WithOrigins(builder.Configuration["Frontend:Origin"] ?? "http://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials());
});

var jwtKey = builder.Configuration["Jwt:Key"] ?? "replace-me-in-production-with-long-random-key";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "alife-api",
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "alife-web",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };

        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                if (context.Request.Cookies.TryGetValue("alife_auth", out var token))
                {
                    context.Token = token;
                }

                return Task.CompletedTask;
            },
            OnChallenge = context =>
            {
                context.HandleResponse();
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                return Task.CompletedTask;
            },
            OnForbidden = context =>
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

app.MapOpenApi();
app.MapScalarApiReference("/scalar", options =>
{
    options.WithTitle("Alife API Reference");
    options.WithTheme(ScalarTheme.BluePlanet);
    options.WithOpenApiRoutePattern("/openapi/{documentName}.json");
});
app.MapGet("/", () => Results.Redirect("/scalar"));

app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();
ApiHealthCheckSetup.MapEndpoints(app);

// Serve pre-built SPA assets through .NET 10 static asset endpoints.
app.MapStaticAssets();
app.MapControllers();
app.MapFallbackToFile("{*path:regex(^(?!api).*$)}", "index.html");

app.Run();
