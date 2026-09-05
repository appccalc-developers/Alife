namespace Alife.Api.Security;

public static class AuthCookie
{
    public static void WriteApplicationCookie(HttpRequest request, HttpResponse response, string token)
    {
        var (_, secure) = ResolveCookiePolicy(request);
        response.Cookies.Append("alife_application", token, new CookieOptions
        {
            HttpOnly = true, Secure = secure, SameSite = SameSiteMode.Lax,
            Path = "/", MaxAge = TimeSpan.FromHours(72)
        });
    }

    public static void WriteCookie(HttpRequest request, HttpResponse response, string token, DateTime expiresUtc)
        => WriteCookie(request, response, token, expiresUtc, persistent: true);

    public static void WriteCookie(
        HttpRequest request,
        HttpResponse response,
        string token,
        DateTime expiresUtc,
        bool persistent)
    {
        var (sameSite, secure) = ResolveCookiePolicy(request);

        response.Cookies.Append("alife_auth", token, new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = sameSite,
            Expires = persistent ? expiresUtc : null,
            MaxAge = persistent ? expiresUtc - DateTime.UtcNow : null
        });
    }

    public static void WriteOnboardingCookie(HttpRequest request, HttpResponse response, string token)
    {
        var (_, secure) = ResolveCookiePolicy(request);
        response.Cookies.Append("alife_onboarding", token, new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = SameSiteMode.Lax,
            MaxAge = TimeSpan.FromMinutes(30)
        });
    }

    public static void ClearOnboardingCookie(HttpRequest request, HttpResponse response)
    {
        var (_, secure) = ResolveCookiePolicy(request);
        response.Cookies.Delete("alife_onboarding", new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = SameSiteMode.Lax
        });
    }

    public static void ClearCookie(HttpRequest request, HttpResponse response)
    {
        var (sameSite, secure) = ResolveCookiePolicy(request);

        response.Cookies.Delete("alife_auth", new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = sameSite
        });
    }

    public static CookieOptions CreateStateCookieOptions(HttpRequest request, DateTimeOffset expiresUtc)
    {
        var (_, secure) = ResolveCookiePolicy(request);
        return new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = SameSiteMode.Lax,
            Expires = expiresUtc
        };
    }

    private static (SameSiteMode SameSite, bool Secure) ResolveCookiePolicy(HttpRequest request)
    {
        var isHttps = request.IsHttps || (IsForwardedHttps(request) && IsHttpsOriginOrReferer(request));
        return isHttps
            ? (SameSiteMode.None, true)
            : (SameSiteMode.Lax, false);
    }

    private static bool IsForwardedHttps(HttpRequest request)
    {
        if (request.Headers.TryGetValue("X-Forwarded-Proto", out var protoValues))
        {
            foreach (var value in protoValues)
            {
                if (!string.IsNullOrWhiteSpace(value) && value.Contains("https", StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
        }

        return request.Headers.ContainsKey("X-ARR-SSL");
    }

    private static bool IsHttpsOriginOrReferer(HttpRequest request)
    {
        if (request.Headers.TryGetValue("Origin", out var originValues))
        {
            foreach (var value in originValues)
            {
                if (IsHttpsUrl(value))
                {
                    return true;
                }
            }
        }

        if (request.Headers.TryGetValue("Referer", out var refererValues))
        {
            foreach (var value in refererValues)
            {
                if (IsHttpsUrl(value))
                {
                    return true;
                }
            }
        }

        return false;
    }

    private static bool IsHttpsUrl(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        return Uri.TryCreate(value, UriKind.Absolute, out var uri)
               && uri.Scheme.Equals(Uri.UriSchemeHttps, StringComparison.OrdinalIgnoreCase);
    }
}
