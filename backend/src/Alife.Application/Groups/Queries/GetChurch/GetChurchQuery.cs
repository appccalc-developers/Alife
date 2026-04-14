using Alife.Application.Common.Models;
using Alife.Application.Groups.Dtos;
using MediatR;

namespace Alife.Application.Groups.Queries.GetChurch;

public sealed record GetChurchQuery(Guid CurrentMemberId) : IRequest<AppResult<GroupDto>>;
