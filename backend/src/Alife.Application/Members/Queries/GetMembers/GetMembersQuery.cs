using Alife.Application.Common.Models;
using Alife.Application.Members.Dtos;
using MediatR;

namespace Alife.Application.Members.Queries.GetMembers;

public sealed record GetMembersQuery : IRequest<AppResult<IReadOnlyList<MemberSummaryDto>>>;
