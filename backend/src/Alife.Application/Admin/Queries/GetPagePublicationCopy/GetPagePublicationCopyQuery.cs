using Alife.Application.Common.Models;
using Alife.Application.Pages.Dtos;
using MediatR;

namespace Alife.Application.Admin.Queries.GetPagePublicationCopy;

public sealed record GetPagePublicationCopyQuery(Guid CurrentMemberId, Guid PageId)
    : IRequest<AppResult<PageDetailDto>>;
