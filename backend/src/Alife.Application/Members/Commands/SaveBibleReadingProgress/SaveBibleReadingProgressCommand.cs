using Alife.Application.Common.Models;
using Alife.Application.Members.Dtos;
using MediatR;

namespace Alife.Application.Members.Commands.SaveBibleReadingProgress;

public sealed record SaveBibleReadingProgressCommand(
    Guid MemberId,
    string Book,
    int Chapter,
    string Language,
    string? ZhVersion,
    string? EnVersion)
    : IRequest<AppResult<BibleReadingProgressDto>>;
