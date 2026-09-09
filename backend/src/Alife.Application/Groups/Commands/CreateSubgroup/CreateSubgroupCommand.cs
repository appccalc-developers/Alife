using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using Alife.Domain.Enums;
using MediatR;

namespace Alife.Application.Groups.Commands.CreateSubgroup;

public sealed record CreateSubgroupCommand(
    Guid GroupId,
    Guid CurrentMemberId,
    IReadOnlyDictionary<string, string> Name,
    IReadOnlyDictionary<string, string>? Description,
    AccessType AccessType,
    GroupType GroupType = GroupType.Fellowship)
    : IRequest<AppResult<GroupDto>>;
