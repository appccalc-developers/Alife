import { ramLegacyDetailsText } from '../../i18n/ramLegacyDetails.ts'
import type { EventRamDraft } from '../../types/event'
import { displayRamText as text } from '../../types/ramGovernance'

/** Keep historical supporting facts readable without turning them into new signatures or ratings. */
export default function RamLegacyDetails({ json, zh, expanded = false }: { json: string; zh: boolean; expanded?: boolean }) {
  let legacy: Partial<EventRamDraft>
  try { legacy = JSON.parse(json) } catch { return null }
  const labels: Record<string, [string, string]> = {
    transportRequired: [ramLegacyDetailsText.transportRequired.en, ramLegacyDetailsText.transportRequired.zh], licensedDriverConfirmed: [ramLegacyDetailsText.driverLicenceChecked.en, ramLegacyDetailsText.driverLicenceChecked.zh], vehicleRegistrationConfirmed: [ramLegacyDetailsText.vehicleRegistrationChecked.en, ramLegacyDetailsText.vehicleRegistrationChecked.zh], vehicleWofConfirmed: [ramLegacyDetailsText.vehicleRoadworthinessChecked.en, ramLegacyDetailsText.vehicleRoadworthinessChecked.zh], venueRiskAssessed: [ramLegacyDetailsText.venueRisksAssessed.en, ramLegacyDetailsText.venueRisksAssessed.zh], firstAidKitAvailable: [ramLegacyDetailsText.firstAidKitAvailable.en, ramLegacyDetailsText.firstAidKitAvailable.zh], trainedFirstAiderName: [ramLegacyDetailsText.firstAider.en, ramLegacyDetailsText.firstAider.zh], trainedFirstAiderQualificationConfirmed: [ramLegacyDetailsText.firstAidQualificationChecked.en, ramLegacyDetailsText.firstAidQualificationChecked.zh], participantHealthNeedsReviewed: [ramLegacyDetailsText.participantSupportArrangementsReviewed.en, ramLegacyDetailsText.participantSupportArrangementsReviewed.zh], weatherPlanReviewed: [ramLegacyDetailsText.weatherPlanReviewed.en, ramLegacyDetailsText.weatherPlanReviewed.zh],
  }
  if (!legacy.activityDescription && !legacy.emergencyContacts?.length && !legacy.outingSafety) return null
  return <details open={expanded || undefined} className="space-y-3 rounded-xl border p-4"><summary className="min-h-11 cursor-pointer font-semibold">{zh ? ramLegacyDetailsText.legacySupportingInformationOriginalRecord.zh : ramLegacyDetailsText.legacySupportingInformationOriginalRecord.en}</summary>
    <p>{text(legacy.activityDescription, zh)}</p><p>{zh ? ramLegacyDetailsText.ageRange.zh : ramLegacyDetailsText.ageRange.en}: {text(legacy.participantAgeRange, zh)}</p>
    {legacy.emergencyContacts?.length ? <section><h3 className="font-semibold">{zh ? ramLegacyDetailsText.existingEmergencyContacts.zh : ramLegacyDetailsText.existingEmergencyContacts.en}</h3>{legacy.emergencyContacts.map((contact, i) => <p key={i} className="text-sm">{text(contact.role, zh)} · {contact.name} · {contact.phone}</p>)}</section> : null}
    {legacy.outingSafety ? <dl className="space-y-2 text-sm">{Object.entries(legacy.outingSafety).map(([key, value]) => <div key={key}><dt className="inline font-semibold">{labels[key]?.[zh ? 1 : 0] || key}: </dt><dd className="inline">{value === true ? (zh ? ramLegacyDetailsText.confirmed.zh : ramLegacyDetailsText.confirmed.en) : value === false ? (zh ? ramLegacyDetailsText.no.zh : ramLegacyDetailsText.no.en) : value || '—'}</dd></div>)}</dl> : null}
    <p className="text-xs text-[#66766f]">{zh ? ramLegacyDetailsText.theseHistoricalFactsDoNotConstituteANewResidual.zh : ramLegacyDetailsText.theseHistoricalFactsDoNotConstituteANewResidual.en}</p>
  </details>
}
