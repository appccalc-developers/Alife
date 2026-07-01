using Alife.Application.Admin.Dtos;
using Alife.Application.Common.Models;
using MediatR;

namespace Alife.Application.Admin.Commands.BackfillMemberPrivateFiles;

public sealed record BackfillMemberPrivateFilesCommand(
    Guid CurrentMemberId,
    bool DryRun,
    int MaxItems) : IRequest<AppResult<FileAssetPrivateBackfillResultDto>>;
