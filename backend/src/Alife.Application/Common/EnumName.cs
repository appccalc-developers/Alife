using System.Text.Json;

namespace Alife.Application.Common;

public static class EnumName
{
    public static string CamelCase<TEnum>(TEnum value)
        where TEnum : struct, Enum
        => JsonNamingPolicy.CamelCase.ConvertName(value.ToString());
}
