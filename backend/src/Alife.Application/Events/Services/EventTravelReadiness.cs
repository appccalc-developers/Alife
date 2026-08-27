using System.Text.Json;
using Alife.Application.Events.Dtos;
using Alife.Domain.Entities;
using Alife.Domain.Enums;

namespace Alife.Application.Events.Services;

public sealed record EventTravelReadinessEvaluation(
    EventTravelRamEvidenceDto RamEvidence,
    EventTravelReadinessDto Readiness);

public static class EventTravelReadiness
{
    public static EventTravelReadinessEvaluation Evaluate(
        IReadOnlyCollection<EventTravelJourney> journeys,
        EventRamAssessment? ram,
        bool accommodationRequired)
    {
        var evidence = ReadRamEvidence(ram);
        var blockers = new List<LocalizedTextDto>();
        var active = journeys.Where(x => x.Status != EventTravelJourneyStatus.Cancelled).ToArray();

        var transportFactsConfirmed = evidence.TransportRequired == true;
        if (!transportFactsConfirmed)
        {
            blockers.Add(new(
                "Required RAM transport facts are not confirmed.",
                "RAM 中必要的交通事實尚未確認。"));
        }
        if (!evidence.ChecksComplete)
        {
            blockers.Add(new(
                "Required RAM transport checks are incomplete; use the existing RAM review flow.",
                "必要的 RAM 交通檢查尚未完成；請沿用既有 RAM 審查流程。"));
        }
        if (active.Length == 0)
        {
            blockers.Add(new("Create at least one pickup journey for a scheduled occurrence.", "請為已排程場次建立至少一個接送行程。"));
        }

        var driversQualified = active.Length > 0;
        var vehiclesQualified = active.Length > 0;
        var manifestsComplete = active.Length > 0;
        foreach (var journey in active)
        {
            var labelEn = string.IsNullOrWhiteSpace(journey.NameEn) ? "Journey" : journey.NameEn;
            var labelZh = string.IsNullOrWhiteSpace(journey.NameZh) ? "行程" : journey.NameZh;
            var localDate = journey.EventOccurrence.LocalDate;
            var driverEligible = journey.Driver is { IsActive: true, LicenceConfirmed: true, FitToDriveConfirmed: true } driver &&
                driver.LicenceExpiresOn.HasValue && driver.LicenceExpiresOn.Value >= localDate;
            if (!driverEligible)
            {
                driversQualified = false;
                blockers.Add(new(
                    $"{labelEn}: no eligible driver is assigned.",
                    $"{labelZh}：尚未指派符合資格的司機。"));
            }

            var vehicleComplete = journey.Vehicle is { IsActive: true, RegistrationConfirmed: true, WofConfirmed: true } vehicle &&
                vehicle.RegistrationExpiresOn.HasValue && vehicle.RegistrationExpiresOn.Value >= localDate &&
                vehicle.WofExpiresOn.HasValue && vehicle.WofExpiresOn.Value >= localDate;
            if (!vehicleComplete)
            {
                vehiclesQualified = false;
                blockers.Add(new(
                    $"{labelEn}: vehicle evidence is incomplete or expired.",
                    $"{labelZh}：車輛證據不完整或已到期。"));
            }

            var assignments = journey.PassengerAssignments.Where(x => !x.EndedUtc.HasValue).ToArray();
            var stopIds = journey.PickupStops.Select(x => x.Id).ToHashSet();
            if (journey.PickupStops.Count == 0 || assignments.Length == 0 ||
                assignments.Any(x => !stopIds.Contains(x.PickupStopId)) || !journey.ManifestConfirmed)
            {
                manifestsComplete = false;
                blockers.Add(new(
                    $"{labelEn}: passenger manifest is incomplete or not confirmed.",
                    $"{labelZh}：乘客名單不完整或尚未確認。"));
            }
            if (journey.Vehicle is not null && assignments.Length > journey.Vehicle.SeatCapacity)
            {
                manifestsComplete = false;
                blockers.Add(new(
                    $"{labelEn}: {assignments.Length} passengers exceed vehicle capacity {journey.Vehicle.SeatCapacity}.",
                    $"{labelZh}：{assignments.Length} 名乘客超過車輛容量 {journey.Vehicle.SeatCapacity}。"));
            }
        }

        if (accommodationRequired)
        {
            manifestsComplete = false;
            blockers.Add(new(
                "Accommodation readiness is intentionally deferred to a later MOVE.STAY slice.",
                "住宿準備度已明確延後至後續 MOVE.STAY 切片。"));
        }

        return new(evidence, new(
            transportFactsConfirmed,
            driversQualified && vehiclesQualified,
            manifestsComplete,
            evidence.ChecksComplete,
            blockers.Distinct().ToArray()));
    }

    public static EventTravelRamEvidenceDto ReadRamEvidence(EventRamAssessment? ram)
    {
        bool? transport = null;
        bool? driver = null;
        bool? registration = null;
        bool? wof = null;
        if (ram is not null)
        {
            try
            {
                using var document = JsonDocument.Parse(ram.RamDataJson);
                if (document.RootElement.TryGetProperty("outingSafety", out var safety) && safety.ValueKind == JsonValueKind.Object)
                {
                    transport = ReadBoolean(safety, "transportRequired");
                    driver = ReadBoolean(safety, "licensedDriverConfirmed");
                    registration = ReadBoolean(safety, "vehicleRegistrationConfirmed");
                    wof = ReadBoolean(safety, "vehicleWofConfirmed");
                }
            }
            catch (JsonException)
            {
                // Existing RAM validation owns malformed JSON. Travel readiness remains safely blocked.
            }
        }
        return new(transport, driver, registration, wof, ram?.Status ?? EventRamStatus.Draft,
            transport == true && driver == true && registration == true && wof == true);
    }

    private static bool? ReadBoolean(JsonElement parent, string name)
        => !parent.TryGetProperty(name, out var value) ? null : value.ValueKind switch
        {
            JsonValueKind.True => true,
            JsonValueKind.False => false,
            _ => null
        };
}
