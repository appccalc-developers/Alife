using System.Text;
using Alife.Api;
using Alife.Api.Security;
using Alife.Application;
using Alife.Application.Abstractions.Identity;
using Alife.Infrastructure;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddHybridCache();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentMemberAccessor, CurrentMemberAccessor>();
builder.Services.AddControllers();
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

app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.SwaggerEndpoint("/swagger/v1/swagger.json", "Alife API v1");
    options.RoutePrefix = "swagger";
});
app.MapGet("/", () => Results.Redirect("/swagger"));

app.UseCors("Frontend");
app.UseAuthentication();
app.UseAuthorization();
ApiHealthCheckSetup.MapEndpoints(app);

app.MapControllers();

app.Run();
