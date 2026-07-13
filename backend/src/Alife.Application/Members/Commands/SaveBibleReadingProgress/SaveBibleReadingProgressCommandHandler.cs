using System.Text.RegularExpressions;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Members.Dtos;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Members.Commands.SaveBibleReadingProgress;

public sealed partial class SaveBibleReadingProgressCommandHandler(IAlifeDbContext dbContext)
    : IRequestHandler<SaveBibleReadingProgressCommand, AppResult<BibleReadingProgressDto>>
{
    public async Task<AppResult<BibleReadingProgressDto>> Handle(
        SaveBibleReadingProgressCommand request,
        CancellationToken cancellationToken)
    {
        var book = request.Book.Trim().ToUpperInvariant();
        if (!BookCodePattern().IsMatch(book))
        {
            return AppResult<BibleReadingProgressDto>.Validation("Bible book code is invalid.");
        }

        if (request.Chapter is < 1 or > 150)
        {
            return AppResult<BibleReadingProgressDto>.Validation("Bible chapter is invalid.");
        }

        var language = request.Language.Trim().ToLowerInvariant();
        if (language is not ("zh" or "en"))
        {
            return AppResult<BibleReadingProgressDto>.Validation("Bible language must be zh or en.");
        }

        var zhVersion = NormalizeVersion(request.ZhVersion);
        var enVersion = NormalizeVersion(request.EnVersion);
        if (zhVersion?.Length > 50 || enVersion?.Length > 50)
        {
            return AppResult<BibleReadingProgressDto>.Validation("Bible version identifier is too long.");
        }

        var progress = await dbContext.BibleReadingProgresses
            .FirstOrDefaultAsync(x => x.MemberId == request.MemberId, cancellationToken);
        var now = DateTime.UtcNow;

        if (progress is null)
        {
            progress = new BibleReadingProgress { MemberId = request.MemberId };
            dbContext.BibleReadingProgresses.Add(progress);
        }

        progress.Book = book;
        progress.Chapter = request.Chapter;
        progress.Language = language;
        progress.ZhVersion = zhVersion;
        progress.EnVersion = enVersion;
        progress.UpdatedUtc = now;
        await dbContext.SaveChangesAsync(cancellationToken);

        return AppResult<BibleReadingProgressDto>.Success(new BibleReadingProgressDto(
            progress.Book,
            progress.Chapter,
            progress.Language,
            progress.ZhVersion,
            progress.EnVersion,
            progress.UpdatedUtc));
    }

    private static string? NormalizeVersion(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    [GeneratedRegex("^[A-Z0-9]{3,10}$", RegexOptions.CultureInvariant)]
    private static partial Regex BookCodePattern();
}
