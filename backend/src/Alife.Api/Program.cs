using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Alife.Api;
using Alife.Api.Security;
using Alife.Application;
using Alife.Application.Abstractions.Identity;
using Alife.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Builder;
using Microsoft.IdentityModel.Tokens;
using Fido2NetLib;

var builder = FunctionsApplication.CreateBuilder(args);
builder.ConfigureFunctionsWebApplication();

builder.Services.AddApplicationInsightsTelemetryWorkerService();
builder.Services.ConfigureFunctionsApplicationInsights();

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentMemberAccessor, CurrentMemberAccessor>();
builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(
            new JsonStringEnumConverter(JsonNamingPolicy.CamelCase, allowIntegerValues: false));
    })
    .AddApplicationPart(typeof(Alife.Api.Controllers.GroupsController).Assembly);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddProblemDetails();

var frontendBaseUrl = builder.Configuration["Frontend:BaseUrl"] ?? "http://localhost:5173";
var frontendOrigin = Uri.TryCreate(frontendBaseUrl, UriKind.Absolute, out var configuredFrontendUri)
    ? configuredFrontendUri.GetLeftPart(UriPartial.Authority)
    : "http://localhost:5173";
var passkeyOrigins = builder.Configuration.GetSection("Passkeys:Origins").Get<string[]>()
    ?.Where(value => !string.IsNullOrWhiteSpace(value))
    .Select(value => value.Trim().TrimEnd('/'))
    .ToHashSet(StringComparer.OrdinalIgnoreCase)
    ?? new HashSet<string>(StringComparer.OrdinalIgnoreCase) { frontendOrigin };
builder.Services.AddFido2(options =>
{
    options.ServerDomain = builder.Configuration["Passkeys:RpId"] ?? configuredFrontendUri?.Host ?? "localhost";
    options.ServerName = builder.Configuration["Passkeys:RpName"] ?? "ALIFE";
    options.Origins = passkeyOrigins;
});

var jwtKey = builder.Configuration["Jwt:Key"] ?? "replace-me-in-production-with-long-random-key";
var jwtKeyId = builder.Configuration["Jwt:KeyId"] ?? "alife-local-hs256";
var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
{
    KeyId = jwtKeyId
};

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "alife-api",
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "alife-web",
            IssuerSigningKey = signingKey,
            TryAllIssuerSigningKeys = true,
            ValidAlgorithms = [SecurityAlgorithms.HmacSha256]
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
            OnAuthenticationFailed = context =>
            {
                context.NoResult();
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
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
builder.Services.AddSingleton<ApiHttpPipeline>();

var app = builder.Build();
await app.RunAsync();
