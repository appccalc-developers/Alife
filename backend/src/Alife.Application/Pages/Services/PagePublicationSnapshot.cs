using Alife.Application.Pages.Dtos;
using Alife.Domain.Entities;
using Alife.Domain.Enums;
using System.Text.Json;

namespace Alife.Application.Pages.Services;

public sealed record PagePublicationSnapshot(
    int Version,
    Guid PageId,
    Guid OwnerGroupId,
    Guid CreatedByMemberId,
    string TitleJson,
    string? DescriptionJson,
    string TagsJson,
    string TitleDisplayStyle,
    DateTime ContentUpdatedUtc,
    DateTime CapturedUtc,
    IReadOnlyList<PagePublicationSnapshotSection> Sections);

public sealed record PagePublicationSnapshotSection(
    Guid? Id,
    int Order,
    SectionType Type,
    string ContentJson,
    string StyleJson,
    IReadOnlyList<PagePublicationSnapshotLink>? Links);

public sealed record PagePublicationSnapshotLink(
    Guid? Id,
    LinkType Type,
    Guid? TargetGroupId,
    Guid? TargetPageId,
    string Title,
    string? ImageUrl,
    int SortOrder);

public static class PagePublicationSnapshots
{
    private const int CurrentVersion = 1;
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    public static string Capture(Page page, IEnumerable<Section> sections, DateTime capturedUtc)
        => Write(new PagePublicationSnapshot(
            CurrentVersion,
            page.Id,
            page.OwnerGroupId,
            page.CreatedByMemberId,
            page.TitleJson,
            page.DescriptionJson,
            page.TagsJson,
            page.TitleDisplayStyle,
            page.UpdatedUtc,
            capturedUtc,
            sections
                .Where(section => !section.IsDeleted)
                .OrderBy(section => section.Order)
                .ThenBy(section => section.Id)
                .Select(section => new PagePublicationSnapshotSection(
                    section.Id,
                    section.Order,
                    section.Type,
                    section.ContentJson,
                    section.StyleJson,
                    section.Links
                        .OrderBy(link => link.SortOrder)
                        .ThenBy(link => link.Id)
                        .Select(link => new PagePublicationSnapshotLink(
                            link.Id,
                            link.Type,
                            link.TargetGroupId,
                            link.TargetPageId,
                            link.Title,
                            link.ImageUrl,
                            link.SortOrder))
                        .ToList()))
                .ToList()));

    public static string Capture(
        Page page,
        IReadOnlyDictionary<string, string> title,
        IReadOnlyDictionary<string, string>? description,
        string? tagsJson,
        string? titleDisplayStyle,
        IReadOnlyList<PageSectionDto> sections,
        DateTime contentUpdatedUtc,
        DateTime capturedUtc,
        PagePublicationSnapshot? existingSnapshot = null)
        => Write(new PagePublicationSnapshot(
            CurrentVersion,
            page.Id,
            page.OwnerGroupId,
            page.CreatedByMemberId,
            JsonSerializer.Serialize(title),
            description is null ? null : JsonSerializer.Serialize(description),
            tagsJson ?? "[]",
            string.IsNullOrWhiteSpace(titleDisplayStyle) ? "Default" : titleDisplayStyle,
            contentUpdatedUtc,
            capturedUtc,
            sections
                .OrderBy(section => section.Order)
                .Select((section, index) => new PagePublicationSnapshotSection(
                    section.Id ?? Guid.NewGuid(),
                    index + 1,
                    section.Type,
                    string.IsNullOrWhiteSpace(section.ContentJson) ? "{}" : section.ContentJson,
                    string.IsNullOrWhiteSpace(section.StyleJson) ? "{}" : section.StyleJson,
                    existingSnapshot?.Sections
                        .FirstOrDefault(existing => existing.Id == section.Id)
                        ?.Links ?? []))
                .ToList()));

    public static PagePublicationSnapshot? Read(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        try
        {
            var snapshot = JsonSerializer.Deserialize<PagePublicationSnapshot>(value, SerializerOptions);
            return snapshot is { Version: CurrentVersion } ? snapshot : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public static PageDetailDto ToDetailDto(PagePublicationSnapshot snapshot)
        => new(
            snapshot.PageId,
            snapshot.OwnerGroupId,
            snapshot.CreatedByMemberId,
            ReadTextMap(snapshot.TitleJson),
            ReadNullableTextMap(snapshot.DescriptionJson),
            snapshot.TagsJson,
            snapshot.TitleDisplayStyle,
            PageVisibility.Public,
            snapshot.ContentUpdatedUtc,
            snapshot.Sections
                .OrderBy(section => section.Order)
                .Select(section => new PageSectionDto(
                    section.Id,
                    section.Order,
                    section.Type,
                    section.ContentJson,
                    section.StyleJson))
                .ToList());

    public static PageDto ToPageDto(PagePublicationSnapshot snapshot)
        => new(
            snapshot.PageId,
            snapshot.OwnerGroupId,
            snapshot.CreatedByMemberId,
            ReadTextMap(snapshot.TitleJson),
            ReadNullableTextMap(snapshot.DescriptionJson),
            snapshot.TagsJson,
            snapshot.TitleDisplayStyle,
            PageVisibility.Public,
            snapshot.ContentUpdatedUtc);

    private static string Write(PagePublicationSnapshot snapshot)
        => JsonSerializer.Serialize(snapshot, SerializerOptions);

    private static IReadOnlyDictionary<string, string> ReadTextMap(string? value)
        => ReadNullableTextMap(value) ?? new Dictionary<string, string>();

    private static IReadOnlyDictionary<string, string>? ReadNullableTextMap(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, string>>(value);
        }
        catch (JsonException)
        {
            return new Dictionary<string, string> { ["en"] = value };
        }
    }
}
