using System.Text;
using Alife.Api;
using Alife.Api.Security;
using Alife.Application;
using Alife.Application.Abstractions.Identity;
using Alife.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Azure.Functions.Worker;
using Microsoft.Azure.Functions.Worker.Builder;
using Microsoft.IdentityModel.Tokens;

var builder = FunctionsApplication.CreateBuilder(args);
builder.ConfigureFunctionsWebApplication();

builder.Services.AddApplicationInsightsTelemetryWorkerService();
builder.Services.ConfigureFunctionsApplicationInsights();

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddHybridCache();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentMemberAccessor, CurrentMemberAccessor>();
builder.Services
    .AddControllers()
    .AddApplicationPart(typeof(Alife.Api.Controllers.GroupsController).Assembly);
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddProblemDetails();
ApiHealthCheckSetup.ConfigureServices(builder.Services);

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
        policy.SetIsOriginAllowed(_ => true)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials());
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
