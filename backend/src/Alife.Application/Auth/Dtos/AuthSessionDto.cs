namespace Alife.Application.Auth.Dtos;

public sealed record AuthSessionDto(
    string Token,
    DateTime ExpiresUtc,
    bool IsGuest,
    bool IsAdmin);
