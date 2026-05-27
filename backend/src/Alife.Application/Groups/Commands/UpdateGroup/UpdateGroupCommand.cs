using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using Alife.Domain.Enums;
using MediatR;

namespace Alife.Application.Groups.Commands.UpdateGroup;

public sealed record UpdateGroupCommand(
    Guid GroupId,
    Guid CurrentMemberId,
    IReadOnlyDictionary<string, string> Name,
    IReadOnlyDictionary<string, string>? Description,
    AccessType AccessType,
    bool IsClosed)
    : IRequest<AppResult<GroupDto>>;
