using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Alife.Api.Controllers;
using Alife.Api.Security;
using Alife.Application.Abstractions.Identity;
using Alife.Application.Abstractions.Integrations;
using Alife.Application.IdentityAccess;
using Alife.Application.Members.Commands.SaveBibleReadingProgress;
using Alife.Application.Members.Queries.GetBibleReadingProgress;
using Alife.Infrastructure.Persistence;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using NSubstitute;

namespace Alife.Tests.Unit.Members;

// Invoke the actual API request pipeline, MVC, JWT middleware, member accessor
// and progress handlers with synthetic tokens and an owned InMemory database.
// Never run Program/AddInfrastructure, a listening host or the configured SQL.
public sealed class BibleReadingProgressPipelineTests
{
    private const string Path = "/api/me/bible-reading-progress";
    private const string ValidBody = """{"book":"jhn","chapter":3,"language":"zh","zhVersion":"123","enVersion":"206"}""";

    [Theory]
    [InlineData("GET", "missing")]
    [InlineData("PUT", "missing")]
    [InlineData("GET", "malformed")]
    [InlineData("PUT", "malformed")]
    [InlineData("GET", "wrong-signature")]
    [InlineData("PUT", "wrong-signature")]
    [InlineData("GET", "expired")]
    [InlineData("PUT", "expired")]
    [InlineData("GET", "wrong-issuer")]
    [InlineData("PUT", "wrong-issuer")]
    [InlineData("GET", "wrong-audience")]
    [InlineData("PUT", "wrong-audience")]
    [InlineData("GET", "wrong-algorithm")]
    [InlineData("PUT", "wrong-algorithm")]
    [InlineData("GET", "invalid-member")]
    [InlineData("PUT", "invalid-member")]
    public async Task DeniedRequests_DoNotDispatchOrStoreResponses(string method, string credential)
    {
        await using var fixture = new PipelineFixture();
        var token = credential == "missing" ? null : credential == "malformed" ? "not-a-jwt" : fixture.Token(Guid.NewGuid(), credential);

        var response = await fixture.Send(method, token, method == "PUT" ? ValidBody : null);

        Assert.Equal(StatusCodes.Status401Unauthorized, response.Response.StatusCode);
        Assert.Empty(fixture.Mediator.ReceivedCalls());
        Assert.Empty(fixture.Database.BibleReadingProgresses);
        AssertNoStore(response);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task CookieAndBearer_UseSignedMemberNotSpoofedQueryOrBody(bool bearer)
    {
        await using var fixture = new PipelineFixture();
        var member = Guid.NewGuid();
        var other = Guid.NewGuid();
        var token = fixture.Token(member);
        var body = ValidBody.Replace("\"book\"", $"\"memberId\":\"{other}\",\"book\"");

        var saved = await fixture.Send("PUT", token, body, $"?memberId={other}", bearer);
        Assert.Equal(StatusCodes.Status200OK, saved.Response.StatusCode);
        AssertNoStore(saved);
        Assert.Equal(member, (await fixture.Database.BibleReadingProgresses.SingleAsync()).MemberId);

        var read = await fixture.Send("GET", token, query: $"?memberId={other}", bearer: bearer);
        Assert.Equal(StatusCodes.Status200OK, read.Response.StatusCode);
        AssertNoStore(read);
        var payload = await ReadBody(read);
        Assert.Equal("JHN", payload.GetProperty("book").GetString());
        Assert.Equal(3, payload.GetProperty("chapter").GetInt32());
        Assert.Equal("zh", payload.GetProperty("language").GetString());
        Assert.Equal("123", payload.GetProperty("zhVersion").GetString());
        Assert.Equal("206", payload.GetProperty("enVersion").GetString());
    }

    [Fact]
    public async Task AlternatingMembers_DoNotReadOrOverwriteEachOthersProgress()
    {
        await using var fixture = new PipelineFixture();
        var first = Guid.NewGuid();
        var second = Guid.NewGuid();
        var firstToken = fixture.Token(first);
        var secondToken = fixture.Token(second);
        Assert.Equal(200, (await fixture.Send("PUT", firstToken, ValidBody)).Response.StatusCode);

        var missing = await fixture.Send("GET", secondToken, query: $"?memberId={first}");
        Assert.Equal(404, missing.Response.StatusCode);
        AssertNoStore(missing);

        var secondBody = """{"book":"ACT","chapter":4,"language":"en","zhVersion":"46","enVersion":"111"}""";
        Assert.Equal(200, (await fixture.Send("PUT", secondToken, secondBody, $"?memberId={first}")).Response.StatusCode);
        var firstRead = await fixture.Send("GET", firstToken);
        var secondRead = await fixture.Send("GET", secondToken);
        AssertNoStore(firstRead);
        AssertNoStore(secondRead);
        Assert.Equal("JHN", (await ReadBody(firstRead)).GetProperty("book").GetString());
        Assert.Equal("ACT", (await ReadBody(secondRead)).GetProperty("book").GetString());
        Assert.Equal(2, await fixture.Database.BibleReadingProgresses.CountAsync());
    }

    [Theory]
    [InlineData("{\"book\":null,\"chapter\":3,\"language\":\"zh\"}")]
    [InlineData("{\"book\":\"JHN\",\"chapter\":\"invalid\",\"language\":\"zh\"}")]
    public async Task ModelBindingErrors_RejectBeforeDispatchAndRemainNonStored(string body)
    {
        await using var fixture = new PipelineFixture();
        var response = await fixture.Send("PUT", fixture.Token(Guid.NewGuid()), body);

        Assert.Equal(StatusCodes.Status400BadRequest, response.Response.StatusCode);
        Assert.Empty(fixture.Mediator.ReceivedCalls());
        Assert.Empty(fixture.Database.BibleReadingProgresses);
        AssertNoStore(response);
    }

    [Fact]
    public async Task HandlerValidationError_RemainsNonStored()
    {
        await using var fixture = new PipelineFixture();
        var response = await fixture.Send("PUT", fixture.Token(Guid.NewGuid()), ValidBody.Replace("\"chapter\":3", "\"chapter\":0"));
        Assert.Equal(StatusCodes.Status400BadRequest, response.Response.StatusCode);
        Assert.NotEmpty(fixture.Mediator.ReceivedCalls());
        Assert.Empty(fixture.Database.BibleReadingProgresses);
        AssertNoStore(response);
    }

    [Theory]
    [InlineData("/api/me/bible-reading-progress")]
    [InlineData("/API/ME/BIBLE-READING-PROGRESS")]
    [InlineData("/api/me/bible-reading-progress/")]
    public async Task RoutedVariants_KeepPrivacyBeforeAndAfterAuthentication(string path)
    {
        await using var fixture = new PipelineFixture();
        var denied = await fixture.Send("GET", null, path: path);
        Assert.Equal(401, denied.Response.StatusCode);
        AssertNoStore(denied);
        Assert.Empty(fixture.Mediator.ReceivedCalls());

        var token = fixture.Token(Guid.NewGuid());
        var saved = await fixture.Send("PUT", token, ValidBody, path: path);
        Assert.Equal(200, saved.Response.StatusCode);
        AssertNoStore(saved);
        var read = await fixture.Send("GET", token, path: path);
        Assert.Equal(200, read.Response.StatusCode);
        AssertNoStore(read);
        Assert.Single(fixture.Database.BibleReadingProgresses);
    }

    [Theory]
    [InlineData("/api/me/bible-reading-progress-extra")]
    [InlineData("/api/me/bible-reading-progress/extra")]
    [InlineData("/api/public/bible-reading-progress")]
    public async Task UnrelatedPaths_DoNotInheritProgressPrivacyPolicy(string path)
    {
        await using var fixture = new PipelineFixture();
        var response = await fixture.Send("GET", null, path: path);
        Assert.Equal(404, response.Response.StatusCode);
        Assert.Empty(fixture.Mediator.ReceivedCalls());
        Assert.Empty(response.Response.Headers.CacheControl.ToString());
        Assert.Empty(response.Response.Headers.Pragma.ToString());
        Assert.Empty(response.Response.Headers.Vary.ToString());
    }

    private static void AssertNoStore(HttpContext context)
    {
        Assert.Contains("no-store", context.Response.Headers.CacheControl.ToString());
        Assert.Equal("no-cache", context.Response.Headers.Pragma.ToString());
        Assert.Contains("Cookie", context.Response.Headers.Vary.ToString());
        Assert.Contains("Authorization", context.Response.Headers.Vary.ToString());
    }

    private static async Task<JsonElement> ReadBody(HttpContext context)
    {
        context.Response.Body.Position = 0;
        using var json = await JsonDocument.ParseAsync(context.Response.Body);
        return json.RootElement.Clone();
    }

    private sealed class PipelineFixture : IAsyncDisposable
    {
        private const string Issuer = "virtual-church-pipeline-test";
        private const string Audience = "virtual-church-test-client";
        private readonly SymmetricSecurityKey key = new(RandomNumberGenerator.GetBytes(64));
        private readonly WebApplication app;
        private readonly RequestDelegate pipeline;
        public AlifeDbContext Database { get; } = new(new DbContextOptionsBuilder<AlifeDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString()).Options);
        public IMediator Mediator { get; } = Substitute.For<IMediator>();

        public PipelineFixture()
        {
            Mediator.Send(Arg.Any<GetBibleReadingProgressQuery>(), Arg.Any<CancellationToken>())
                .Returns(call => new GetBibleReadingProgressQueryHandler(Database).Handle(call.ArgAt<GetBibleReadingProgressQuery>(0), call.ArgAt<CancellationToken>(1)));
            Mediator.Send(Arg.Any<SaveBibleReadingProgressCommand>(), Arg.Any<CancellationToken>())
                .Returns(call => new SaveBibleReadingProgressCommandHandler(Database).Handle(call.ArgAt<SaveBibleReadingProgressCommand>(0), call.ArgAt<CancellationToken>(1)));

            var builder = WebApplication.CreateBuilder(new WebApplicationOptions
            {
                Args = [], ContentRootPath = AppContext.BaseDirectory, EnvironmentName = Environments.Development
            });
            builder.Configuration.Sources.Clear();
            builder.Logging.ClearProviders();
            builder.Services.AddControllers().AddApplicationPart(typeof(MembersController).Assembly);
            builder.Services.AddEndpointsApiExplorer();
            builder.Services.AddSwaggerGen();
            builder.Services.AddCors(options => options.AddPolicy("Frontend", policy => policy.WithOrigins("http://localhost:5173")));
            builder.Services.AddHttpContextAccessor();
            builder.Services.AddScoped<ICurrentMemberAccessor, CurrentMemberAccessor>();
            builder.Services.AddSingleton(Mediator);
            builder.Services.AddSingleton(Substitute.For<ILineLoginService>());
            builder.Services.AddSingleton(Substitute.For<IIdentityAccessService>());
            // Real JWT middleware with test-owned values; not a test of live
            // key/session issuance or the production host's configuration loader.
            builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
            {
                options.MapInboundClaims = false;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true, ValidateAudience = true, ValidateLifetime = true,
                    ValidateIssuerSigningKey = true, ValidIssuer = Issuer, ValidAudience = Audience,
                    IssuerSigningKey = key, TryAllIssuerSigningKeys = true,
                    ValidAlgorithms = [SecurityAlgorithms.HmacSha256]
                };
                options.Events = new JwtBearerEvents
                {
                    OnMessageReceived = context =>
                    {
                        if (context.Request.Cookies.TryGetValue("alife_auth", out var token)) context.Token = token;
                        return Task.CompletedTask;
                    }
                };
            });
            builder.Services.AddAuthorization();
            app = builder.Build();
            // Exercise the actual internal pipeline without changing production
            // visibility or copying its routing/auth/model-binding middleware.
            var type = typeof(MembersController).Assembly.GetType("Alife.Api.ApiHttpPipeline", throwOnError: true)!;
            var instance = Activator.CreateInstance(type, app.Services)!;
            pipeline = type.GetMethod("InvokeAsync")!.CreateDelegate<RequestDelegate>(instance);
            Mediator.ClearReceivedCalls();
        }

        public string Token(Guid member, string variant = "valid")
        {
            var now = DateTime.UtcNow;
            var token = new JwtSecurityToken(
                issuer: variant == "wrong-issuer" ? "other-issuer" : Issuer,
                audience: variant == "wrong-audience" ? "other-audience" : Audience,
                claims: [new Claim("sub", variant == "invalid-member" ? "invalid-member" : member.ToString())],
                notBefore: now.AddMinutes(-30), expires: variant == "expired" ? now.AddMinutes(-20) : now.AddMinutes(5),
                signingCredentials: new SigningCredentials(variant == "wrong-signature" ? new SymmetricSecurityKey(RandomNumberGenerator.GetBytes(64)) : key,
                    variant == "wrong-algorithm" ? SecurityAlgorithms.HmacSha384 : SecurityAlgorithms.HmacSha256));
            return new JwtSecurityTokenHandler().WriteToken(token);
        }

        public async Task<DefaultHttpContext> Send(string method, string? token, string? body = null, string? query = null, bool bearer = false, string path = Path)
        {
            await using var scope = app.Services.CreateAsyncScope();
            var context = new DefaultHttpContext { RequestServices = scope.ServiceProvider };
            context.Request.Method = method;
            context.Request.Scheme = "http";
            context.Request.Host = new HostString("localhost");
            context.Request.Path = path;
            if (query is not null) context.Request.QueryString = new QueryString(query);
            if (token is not null) context.Request.Headers[bearer ? "Authorization" : "Cookie"] = bearer ? $"Bearer {token}" : $"alife_auth={token}";
            context.Features.Set<IHttpRequestBodyDetectionFeature>(new BodyDetection(body is not null));
            if (body is not null)
            {
                var bytes = Encoding.UTF8.GetBytes(body);
                context.Request.Body = new MemoryStream(bytes);
                context.Request.ContentLength = bytes.Length;
                context.Request.ContentType = "application/json";
            }
            context.Response.Body = new MemoryStream();
            var accessor = scope.ServiceProvider.GetRequiredService<IHttpContextAccessor>();
            var previous = accessor.HttpContext;
            accessor.HttpContext = context;
            try { await pipeline(context); }
            finally { accessor.HttpContext = previous; }
            return context;
        }

        public async ValueTask DisposeAsync()
        {
            await app.DisposeAsync();
            await Database.DisposeAsync();
        }

        private sealed class BodyDetection(bool canHaveBody) : IHttpRequestBodyDetectionFeature
        {
            public bool CanHaveBody => canHaveBody;
        }
    }
}
