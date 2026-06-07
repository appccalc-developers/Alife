using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using MediatR;

namespace Alife.Application.Groups.Queries.GetGroupById;

public sealed record GetGroupByIdQuery(Guid GroupId, Guid? CurrentMemberId) : IRequest<AppResult<GroupDto>>;
