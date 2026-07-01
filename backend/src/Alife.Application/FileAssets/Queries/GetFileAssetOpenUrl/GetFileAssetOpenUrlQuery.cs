using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.FileAssets.Queries.GetFileAssetOpenUrl;

public sealed record GetFileAssetOpenUrlQuery(
    Guid CurrentMemberId,
    Guid FileAssetId) : IRequest<AppResult<string>>;
