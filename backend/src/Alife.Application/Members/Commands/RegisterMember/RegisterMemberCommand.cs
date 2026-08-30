using Alife.Application.Common.Models;
using Alife.Application.Members.Dtos;
using MediatR;

namespace Alife.Application.Members.Commands.RegisterMember;

public sealed record RegisterMemberCommand(
    Guid? CurrentMemberId,
    string? VerifiedLineUID,
    string Name,
    string? Sex,
    int? Age,
    string? Email,
    bool IsPublicDevice = false)
    : IRequest<AppResult<MemberRegistrationResultDto>>;
