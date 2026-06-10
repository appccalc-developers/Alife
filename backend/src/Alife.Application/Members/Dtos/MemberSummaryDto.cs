namespace Alife.Application.Members.Dtos;

public sealed record MemberSummaryDto(Guid Id, string? DisplayName, string? MembershipStatus = null);
