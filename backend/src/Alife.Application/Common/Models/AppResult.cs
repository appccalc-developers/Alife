namespace Alife.Application.Common.Models;

public enum AppResultStatus
{
    Success,
    NotFound,
    Forbidden,
    ValidationError,
    Conflict,
    PreconditionFailed,
    ServiceUnavailable
}

public sealed class AppResult<T>
{
    private AppResult(AppResultStatus status, T? value = default, string? message = null)
    {
        Status = status;
        Value = value;
        Message = message;
    }

    public AppResultStatus Status { get; }
    public T? Value { get; }
    public string? Message { get; }
    public bool IsSuccess => Status == AppResultStatus.Success;

    public static AppResult<T> Success(T value) => new(AppResultStatus.Success, value);
    public static AppResult<T> NotFound(string message) => new(AppResultStatus.NotFound, message: message);
    public static AppResult<T> Forbidden(string message) => new(AppResultStatus.Forbidden, message: message);
    public static AppResult<T> Validation(string message) => new(AppResultStatus.ValidationError, message: message);
    public static AppResult<T> Conflict(string message) => new(AppResultStatus.Conflict, message: message);
    public static AppResult<T> PreconditionFailed(string message) => new(AppResultStatus.PreconditionFailed, message: message);
    public static AppResult<T> ServiceUnavailable(string message) => new(AppResultStatus.ServiceUnavailable, message: message);
}
