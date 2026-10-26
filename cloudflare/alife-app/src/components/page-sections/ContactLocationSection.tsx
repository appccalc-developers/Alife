import { contactLocationSectionText } from '../../i18n/contactLocationSection.ts'
import LocationSectionPresentation from '../location/LocationSectionPresentation'
import { useAuthStore } from '../../stores/auth'
import {
  defaultContactLocationMapEmbedUrl,
  defaultContactLocationMapUrl,
  defaultContactLocationStreetAddress,
  defaultLocationInquiryContactName,
  defaultLocationInquiryContactPhone,
} from '../../utils/contactLocation'
import {
  EditableText,
  PropertyPanel,
  SelectInput,
  TextInput,
  patchContent,
  patchLocalizedContent,
  readLocalizedText,
  readText,
} from './sectionUtils'
import type { SectionComponentProps } from './types'
import { sectionSpacingClass } from './sectionPresets'

const label = (language: string, en: string, zh: string) => language === 'zh' ? zh : en

const ContactLocationSection = ({ section, mode, domId, disabled, propertiesOnly, showProperties = true, onUpdate }: SectionComponentProps) => {
  const { language } = useAuthStore()
  const editable = mode === 'edit' && !disabled && onUpdate
  const locationTitle = readLocalizedText(section.contentJson, language, 'locationTitle') || label(language, contactLocationSectionText.churchLocation.en, contactLocationSectionText.churchLocation.zh)
  const locationName = readLocalizedText(section.contentJson, language, 'locationName', 'title') || label(language, contactLocationSectionText.chineseAbundantLifeChurch.en, contactLocationSectionText.chineseAbundantLifeChurch.zh)
  const streetAddress = readLocalizedText(section.contentJson, language, 'streetAddress', 'address') || defaultContactLocationStreetAddress
  const locationAddress = readLocalizedText(section.contentJson, language, 'locationAddress', 'addressNote', 'body') || label(language, 'Christchurch, New Zealand', 'Christchurch, New Zealand')
  const contactName = readLocalizedText(section.contentJson, language, 'contactName') || defaultLocationInquiryContactName
  const contactNameLabel = readLocalizedText(section.contentJson, language, 'contactNameLabel') || label(language, contactLocationSectionText.inquiryContact.en, contactLocationSectionText.inquiryContact.zh)
  const contactPhone = readText(section.contentJson, 'contactPhone') || defaultLocationInquiryContactPhone
  const contactPhoneLabel = readLocalizedText(section.contentJson, language, 'contactPhoneLabel') || label(language, contactLocationSectionText.phone.en, contactLocationSectionText.phone.zh)
  const openMapLabel = readLocalizedText(section.contentJson, language, 'openMapLabel', 'linkLabel', 'linkText', 'ctaLabel') || label(language, contactLocationSectionText.openInGoogleMaps.en, contactLocationSectionText.openInGoogleMaps.zh)
  const mapUrl = readText(section.contentJson, 'mapUrl', 'linkUrl', 'ctaUrl', 'href') || defaultContactLocationMapUrl
  const mapEmbedUrl = readText(section.contentJson, 'mapEmbedUrl', 'embedUrl') || defaultContactLocationMapEmbedUrl

  const updateContent = (patch: Record<string, unknown>) => onUpdate?.(patchContent(section, patch))
  const updateLocalizedContent = (patch: Record<string, string>) => onUpdate?.(patchLocalizedContent(section, language, patch))
  const updateLocationName = (value: string) => updateLocalizedContent({ locationName: value, title: value })
  const updateStreetAddress = (value: string) => updateLocalizedContent({ streetAddress: value, address: value })
  const updateLocationAddress = (value: string) => updateLocalizedContent({ locationAddress: value, addressNote: value, body: value })
  const updateContactName = (value: string) => updateLocalizedContent({ contactName: value })
  const updateContactNameLabel = (value: string) => updateLocalizedContent({ contactNameLabel: value })
  const updateContactPhoneLabel = (value: string) => updateLocalizedContent({ contactPhoneLabel: value })
  const updateOpenMapLabel = (value: string) => updateLocalizedContent({ openMapLabel: value, linkLabel: value, linkText: value, ctaLabel: value })

  const renderProperties = () => (
    <PropertyPanel>
      <SelectInput
        focusKey="contact-location-source-mode"
        label={label(language, contactLocationSectionText.datasource.en, contactLocationSectionText.datasource.zh)}
        value="custom"
        disabled={disabled}
        options={[{ value: 'custom', label: label(language, contactLocationSectionText.customized.en, contactLocationSectionText.customized.zh) }]}
        onChange={() => updateContent({ datasource: 'custom', location: { mode: 'custom' } })}
      />
      <TextInput
        focusKey="contact-location-name"
        label={label(language, contactLocationSectionText.locationName.en, contactLocationSectionText.locationName.zh)}
        value={locationName}
        disabled={disabled}
        onChange={updateLocationName}
      />
      <TextInput
        focusKey="contact-location-street-address"
        label={label(language, contactLocationSectionText.streetAddress.en, contactLocationSectionText.streetAddress.zh)}
        value={streetAddress}
        disabled={disabled}
        onChange={updateStreetAddress}
      />
      <TextInput
        focusKey="contact-location-address-note"
        label={label(language, contactLocationSectionText.addressNote.en, contactLocationSectionText.addressNote.zh)}
        value={locationAddress}
        disabled={disabled}
        onChange={updateLocationAddress}
      />
      <TextInput
        focusKey="contact-location-contact-name"
        label={label(language, contactLocationSectionText.contactName.en, contactLocationSectionText.contactName.zh)}
        value={contactName}
        disabled={disabled}
        onChange={updateContactName}
      />
      <TextInput
        focusKey="contact-location-contact-name-label"
        label={label(language, contactLocationSectionText.contactNameLabel.en, contactLocationSectionText.contactNameLabel.zh)}
        value={contactNameLabel}
        disabled={disabled}
        onChange={updateContactNameLabel}
      />
      <TextInput
        focusKey="contact-location-contact-phone"
        label={label(language, contactLocationSectionText.contactPhone.en, contactLocationSectionText.contactPhone.zh)}
        value={contactPhone}
        disabled={disabled}
        onChange={(value) => updateContent({ contactPhone: value })}
      />
      <TextInput
        focusKey="contact-location-contact-phone-label"
        label={label(language, contactLocationSectionText.contactPhoneLabel.en, contactLocationSectionText.contactPhoneLabel.zh)}
        value={contactPhoneLabel}
        disabled={disabled}
        onChange={updateContactPhoneLabel}
      />
      <TextInput
        focusKey="contact-location-map-url"
        label={label(language, contactLocationSectionText.googleMapsLink.en, contactLocationSectionText.googleMapsLink.zh)}
        value={mapUrl}
        disabled={disabled}
        onChange={(value) => updateContent({ mapUrl: value, linkUrl: value, ctaUrl: value, href: value })}
      />
      <TextInput
        focusKey="contact-location-map-embed-url"
        label={label(language, contactLocationSectionText.mapEmbedUrl.en, contactLocationSectionText.mapEmbedUrl.zh)}
        value={mapEmbedUrl}
        disabled={disabled}
        onChange={(value) => updateContent({ mapEmbedUrl: value, embedUrl: value })}
      />
      <TextInput
        focusKey="contact-location-open-map-label"
        label={label(language, contactLocationSectionText.openMapLabel.en, contactLocationSectionText.openMapLabel.zh)}
        value={openMapLabel}
        disabled={disabled}
        onChange={updateOpenMapLabel}
      />
    </PropertyPanel>
  )

  if (propertiesOnly) {
    return renderProperties()
  }

  return (
    <>
      <LocationSectionPresentation
        id={domId}
        sectionClassName={`scroll-mt-24 px-5 sm:px-8 lg:px-10 ${sectionSpacingClass(section)}`}
        locationTitle={locationTitle}
        locationName={(
          <EditableText
            as="span"
            value={locationName}
            fallback={label(language, contactLocationSectionText.locationName2.en, contactLocationSectionText.locationName2.zh)}
            disabled={!editable}
            className="block"
            onChange={updateLocationName}
          />
        )}
        streetAddress={(
          <EditableText
            as="span"
            value={streetAddress}
            fallback={label(language, contactLocationSectionText.streetAddress2.en, contactLocationSectionText.streetAddress2.zh)}
            disabled={!editable}
            className="block"
            onChange={updateStreetAddress}
          />
        )}
        locationAddress={(
          <EditableText
            as="span"
            value={locationAddress}
            fallback={label(language, contactLocationSectionText.addressNote2.en, contactLocationSectionText.addressNote2.zh)}
            disabled={!editable}
            className="block"
            onChange={updateLocationAddress}
          />
        )}
        contactName={(
          <EditableText
            as="span"
            value={contactName}
            fallback={label(language, contactLocationSectionText.contactName2.en, contactLocationSectionText.contactName2.zh)}
            disabled={!editable}
            className="block"
            onChange={updateContactName}
          />
        )}
        contactNameLabel={(
          <EditableText
            as="span"
            value={contactNameLabel}
            fallback={label(language, contactLocationSectionText.inquiryContact2.en, contactLocationSectionText.inquiryContact2.zh)}
            disabled={!editable}
            className="block"
            onChange={updateContactNameLabel}
          />
        )}
        contactPhone={contactPhone}
        contactPhoneLabel={(
          <EditableText
            as="span"
            value={contactPhoneLabel}
            fallback={label(language, contactLocationSectionText.phone2.en, contactLocationSectionText.phone2.zh)}
            disabled={!editable}
            className="block"
            onChange={updateContactPhoneLabel}
          />
        )}
        mapUrl={mapUrl}
        mapEmbedUrl={mapEmbedUrl}
        openMapLabel={(
          <EditableText
            as="span"
            value={openMapLabel}
            fallback={label(language, contactLocationSectionText.openInGoogleMaps2.en, contactLocationSectionText.openInGoogleMaps2.zh)}
            disabled={!editable}
            className="text-sm"
            onChange={updateOpenMapLabel}
          />
        )}
        mapPlaceholder={label(language, contactLocationSectionText.addAMapEmbedUrl.en, contactLocationSectionText.addAMapEmbedUrl.zh)}
        onMapClick={mode === 'edit' ? (event) => event.preventDefault() : undefined}
      />
      {mode === 'edit' && showProperties ? renderProperties() : null}
    </>
  )
}

export default ContactLocationSection
