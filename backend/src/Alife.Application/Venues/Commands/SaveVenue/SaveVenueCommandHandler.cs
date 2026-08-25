using System.Text.Json;
using Alife.Application.Common.Interfaces;
using Alife.Application.Common.Models;
using Alife.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Alife.Application.Venues.Commands.SaveVenue;

public sealed class SaveVenueCommandHandler(IAlifeDbContext db)
    : IRequestHandler<SaveVenueCommand, AppResult<VenueDto>>
{
    public async Task<AppResult<VenueDto>> Handle(SaveVenueCommand request, CancellationToken cancellationToken)
    {
        if (!await VenueAuthorization.CanManageCatalogAsync(db, request.CurrentMemberId, cancellationToken))
            return AppResult<VenueDto>.Forbidden("You do not have permission to maintain the venue catalog.");

        var church = await db.Groups.AsNoTracking().FirstOrDefaultAsync(x => x.Id == request.ChurchGroupId, cancellationToken);
        if (church is null || !church.IsChurch)
            return AppResult<VenueDto>.Validation("Venue catalogs must belong to a church group.");
        if (!VenueAuthorization.HasLocalizedValue(request.NameEn, request.NameZh))
            return AppResult<VenueDto>.Validation("An English or Chinese venue name is required.");
        if (string.IsNullOrWhiteSpace(request.TimeZoneId))
            return AppResult<VenueDto>.Validation("A venue time zone is required.");
        if (request.Spaces.Count == 0)
            return AppResult<VenueDto>.Validation("At least one venue space is required.");
        if (request.Spaces.Any(x => !VenueAuthorization.HasLocalizedValue(x.NameEn, x.NameZh) || x.Capacity < 1))
            return AppResult<VenueDto>.Validation("Every space requires a name and a positive capacity.");
        if (request.Spaces.Where(x => x.Id.HasValue).GroupBy(x => x.Id).Any(x => x.Count() > 1))
            return AppResult<VenueDto>.Validation("A venue space cannot appear more than once.");
        if (request.Spaces.Any(x => !IsJson(x.ResourcesJson, JsonValueKind.Array) || !IsJson(x.BookingPolicyJson, JsonValueKind.Object)))
            return AppResult<VenueDto>.Validation("Resources must be a JSON array and booking policy must be a JSON object.");

        var now = DateTime.UtcNow;
        Venue venue;
        var isNew = !request.VenueId.HasValue;
        if (request.VenueId.HasValue)
        {
            venue = await db.Venues.Include(x => x.Spaces).FirstOrDefaultAsync(x => x.Id == request.VenueId.Value, cancellationToken)
                ?? null!;
            if (venue is null) return AppResult<VenueDto>.NotFound("Venue not found.");
            if (venue.ChurchGroupId != request.ChurchGroupId)
                return AppResult<VenueDto>.Forbidden("The venue belongs to another church.");
        }
        else
        {
            venue = new Venue
            {
                Id = Guid.NewGuid(),
                ChurchGroupId = request.ChurchGroupId,
                CreatedByMemberId = request.CurrentMemberId,
                CreatedUtc = now
            };
            db.Venues.Add(venue);
        }

        venue.NameEn = Fallback(request.NameEn, request.NameZh);
        venue.NameZh = Fallback(request.NameZh, request.NameEn);
        venue.DescriptionEn = request.DescriptionEn.Trim();
        venue.DescriptionZh = request.DescriptionZh.Trim();
        venue.AddressEn = request.AddressEn.Trim();
        venue.AddressZh = request.AddressZh.Trim();
        venue.TimeZoneId = request.TimeZoneId.Trim();
        venue.IsActive = request.IsActive;
        venue.UpdatedByMemberId = request.CurrentMemberId;
        venue.UpdatedUtc = now;

        var suppliedIds = request.Spaces.Where(x => x.Id.HasValue).Select(x => x.Id!.Value).ToHashSet();
        if (venue.Spaces.Any(x => !suppliedIds.Contains(x.Id)))
        {
            foreach (var omitted in venue.Spaces.Where(x => !suppliedIds.Contains(x.Id))) omitted.IsActive = false;
        }

        foreach (var input in request.Spaces)
        {
            VenueSpace space;
            if (input.Id.HasValue)
            {
                space = venue.Spaces.FirstOrDefault(x => x.Id == input.Id.Value) ?? null!;
                if (space is null) return AppResult<VenueDto>.Validation("A venue space does not belong to this venue.");
            }
            else
            {
                space = new VenueSpace { Id = Guid.NewGuid(), VenueId = venue.Id, CreatedUtc = now };
                venue.Spaces.Add(space);
                db.VenueSpaces.Add(space);
            }

            space.NameEn = Fallback(input.NameEn, input.NameZh);
            space.NameZh = Fallback(input.NameZh, input.NameEn);
            space.Capacity = input.Capacity;
            space.ResourcesJson = input.ResourcesJson;
            space.BookingPolicyJson = input.BookingPolicyJson;
            space.IsActive = input.IsActive;
            space.UpdatedUtc = now;
        }

        db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            ActorMemberId = request.CurrentMemberId,
            Action = isNew ? "venue.catalog.created" : "venue.catalog.updated",
            EntityType = nameof(Venue),
            EntityId = venue.Id,
            GroupId = venue.ChurchGroupId,
            AfterJson = JsonSerializer.Serialize(new
            {
                venue.NameEn,
                venue.NameZh,
                venue.IsActive,
                venue.TimeZoneId,
                SpaceCount = venue.Spaces.Count,
                ActiveSpaceCount = venue.Spaces.Count(x => x.IsActive)
            }),
            OccurredUtc = now
        });

        await db.SaveChangesAsync(cancellationToken);
        return AppResult<VenueDto>.Success(VenueMapper.ToDto(venue));
    }

    private static string Fallback(string primary, string secondary) =>
        string.IsNullOrWhiteSpace(primary) ? secondary.Trim() : primary.Trim();

    private static bool IsJson(string value, JsonValueKind expectedKind)
    {
        try
        {
            using var document = JsonDocument.Parse(value);
            return document.RootElement.ValueKind == expectedKind;
        }
        catch (JsonException)
        {
            return false;
        }
    }
}
