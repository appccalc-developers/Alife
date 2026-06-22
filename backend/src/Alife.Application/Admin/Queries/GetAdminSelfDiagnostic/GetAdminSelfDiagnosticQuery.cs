using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Admin.Queries.GetAdminSelfDiagnostic;

public sealed record GetAdminSelfDiagnosticQuery(Guid CurrentMemberId)
    : IRequest<AppResult<AdminSelfDiagnosticDto>>;
