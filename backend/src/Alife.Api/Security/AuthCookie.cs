namespace Alife.Api.Security;

public static class AuthCookie
{
    public static void WriteCookie(HttpResponse response, string token, DateTime expiresUtc, bool isDevelopment)
    {
        var sameSite = isDevelopment ? SameSiteMode.Lax : SameSiteMode.None;
        var secure = !isDevelopment;

        response.Cookies.Append("alife_auth", token, new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = sameSite,
            Expires = expiresUtc
        });
    }

    public static void ClearCookie(HttpResponse response, bool isDevelopment)
    {
        var sameSite = isDevelopment ? SameSiteMode.Lax : SameSiteMode.None;
        var secure = !isDevelopment;

        response.Cookies.Delete("alife_auth", new CookieOptions
        {
            HttpOnly = true,
            Secure = secure,
            SameSite = sameSite
        });
    }
}
