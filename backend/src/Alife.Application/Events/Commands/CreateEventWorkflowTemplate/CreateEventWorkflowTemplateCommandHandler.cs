using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Application.Events.Dtos;
using Alife.Application.Events.Services;
using Alife.Application.Groups.Services;
using Alife.Domain.Entities;
using MediatR;

namespace Alife.Application.Events.Commands.CreateEventWorkflowTemplate;

public sealed class CreateEventWorkflowTemplateCommandHandler(
    IAlifeDbContext dbContext,
    IGroupAuthorizationService groupAuthorizationService)
    : IRequestHandler<CreateEventWorkflowTemplateCommand, AppResult<EventWorkflowTemplateDto>>
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task<AppResult<EventWorkflowTemplateDto>> Handle(
        CreateEventWorkflowTemplateCommand request,
        CancellationToken cancellationToken)
    {
        if (!await groupAuthorizationService.IsLeaderOrCoLeaderAsync(
                request.GroupId,
                request.CurrentMemberId,
                cancellationToken))
        {
            return AppResult<EventWorkflowTemplateDto>.Forbidden(
                "Only group leaders and co-leaders can create workflow templates.");
        }

        if (!TryNormalizeBilingual(request.NameEn, request.NameZh, 200, out var nameEn, out var nameZh))
        {
            return AppResult<EventWorkflowTemplateDto>.Validation(
                "A workflow name is required in at least one language and must be 200 characters or fewer.");
        }

        if (request.Stages.Count is < 1 or > 12)
        {
            return AppResult<EventWorkflowTemplateDto>.Validation(
                "A workflow template must contain between 1 and 12 stages.");
        }

        var stages = new List<object>(request.Stages.Count);
        for (var index = 0; index < request.Stages.Count; index++)
        {
            var stage = request.Stages[index];
            if (!TryNormalizeBilingual(stage.NameEn, stage.NameZh, 200, out var stageNameEn, out var stageNameZh))
            {
                return AppResult<EventWorkflowTemplateDto>.Validation(
                    $"Stage {index + 1} needs a name in at least one language and must be 200 characters or fewer.");
            }

            stages.Add(new
            {
                key = $"stage_{index + 1}",
                name = new { en = stageNameEn, zh = stageNameZh },
                required = true,
                requiresApproval = stage.RequiresApproval,
                integrationKey = (string?)null,
                artifacts = Array.Empty<object>()
            });
        }

        NormalizeOptionalBilingual(
            request.DescriptionEn,
            request.DescriptionZh,
            1000,
            nameEn,
            nameZh,
            out var descriptionEn,
            out var descriptionZh);

        var now = DateTime.UtcNow;
        var template = new EventWorkflowTemplate
        {
            Id = Guid.NewGuid(),
            OwnerGroupId = request.GroupId,
            CreatedByMemberId = request.CurrentMemberId,
            Code = $"custom_{Guid.NewGuid():N}",
            Version = 1,
            NameEn = nameEn,
            NameZh = nameZh,
            DescriptionEn = descriptionEn,
            DescriptionZh = descriptionZh,
            DefinitionJson = JsonSerializer.Serialize(new { stages }, JsonOptions),
            IsActive = true,
            CreatedUtc = now,
            UpdatedUtc = now
        };

        // Parse the serialized definition before saving so an invalid template
        // never becomes visible to later event creation requests.
        try
        {
            EventWorkflowDefinition.Parse(template.DefinitionJson);
        }
        catch (JsonException)
        {
            return AppResult<EventWorkflowTemplateDto>.Validation("The workflow definition is invalid.");
        }

        dbContext.EventWorkflowTemplates.Add(template);
        await dbContext.SaveChangesAsync(cancellationToken);
        return AppResult<EventWorkflowTemplateDto>.Success(EventWorkflowDefinition.ToDto(template));
    }

    private static bool TryNormalizeBilingual(
        string? en,
        string? zh,
        int maxLength,
        out string normalizedEn,
        out string normalizedZh)
    {
        normalizedEn = en?.Trim() ?? string.Empty;
        normalizedZh = zh?.Trim() ?? string.Empty;
        if (normalizedEn.Length > maxLength || normalizedZh.Length > maxLength ||
            (normalizedEn.Length == 0 && normalizedZh.Length == 0))
        {
            return false;
        }

        if (normalizedEn.Length == 0) normalizedEn = normalizedZh;
        if (normalizedZh.Length == 0) normalizedZh = normalizedEn;
        return true;
    }

    private static void NormalizeOptionalBilingual(
        string? en,
        string? zh,
        int maxLength,
        string fallbackEn,
        string fallbackZh,
        out string normalizedEn,
        out string normalizedZh)
    {
        normalizedEn = (en?.Trim() ?? string.Empty);
        normalizedZh = (zh?.Trim() ?? string.Empty);
        if (normalizedEn.Length > maxLength) normalizedEn = normalizedEn[..maxLength];
        if (normalizedZh.Length > maxLength) normalizedZh = normalizedZh[..maxLength];
        if (normalizedEn.Length == 0 && normalizedZh.Length == 0)
        {
            normalizedEn = fallbackEn;
            normalizedZh = fallbackZh;
            return;
        }

        if (normalizedEn.Length == 0) normalizedEn = normalizedZh;
        if (normalizedZh.Length == 0) normalizedZh = normalizedEn;
    }
}
