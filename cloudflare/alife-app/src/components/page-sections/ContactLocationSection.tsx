import LocationSectionPresentation from '../location/LocationSectionPresentation'
import { useAuthStore } from '../../stores/auth'
import { defaultContactLocationMapEmbedUrl, defaultContactLocationMapUrl, defaultContactLocationStreetAddress } from '../../utils/contactLocation'
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
  const locationTitle = readLocalizedText(section.contentJson, language, 'locationTitle') || label(language, 'Church Location', '教会地点')
  const locationName = readLocalizedText(section.contentJson, language, 'locationName', 'title') || label(language, 'Chinese Abundant Life Church', '基督城华人丰盛生命教会')
  const streetAddress = readLocalizedText(section.contentJson, language, 'streetAddress', 'address') || defaultContactLocationStreetAddress
  const locationAddress = readLocalizedText(section.contentJson, language, 'locationAddress', 'addressNote', 'body') || label(language, 'Christchurch, New Zealand', 'Christchurch, New Zealand')
  const openMapLabel = readLocalizedText(section.contentJson, language, 'openMapLabel', 'linkLabel', 'linkText', 'ctaLabel') || label(language, 'Open in Google Maps', '在 Google Maps 打开')
  const mapUrl = readText(section.contentJson, 'mapUrl', 'linkUrl', 'ctaUrl', 'href') || defaultContactLocationMapUrl
  const mapEmbedUrl = readText(section.contentJson, 'mapEmbedUrl', 'embedUrl') || defaultContactLocationMapEmbedUrl

  const updateContent = (patch: Record<string, unknown>) => onUpdate?.(patchContent(section, patch))
  const updateLocalizedContent = (patch: Record<string, string>) => onUpdate?.(patchLocalizedContent(section, language, patch))
  const updateLocationName = (value: string) => updateLocalizedContent({ locationName: value, title: value })
  const updateStreetAddress = (value: string) => updateLocalizedContent({ streetAddress: value, address: value })
  const updateLocationAddress = (value: string) => updateLocalizedContent({ locationAddress: value, addressNote: value, body: value })
  const updateOpenMapLabel = (value: string) => updateLocalizedContent({ openMapLabel: value, linkLabel: value, linkText: value, ctaLabel: value })

  const renderProperties = () => (
    <PropertyPanel>
      <SelectInput
        focusKey="contact-location-source-mode"
        label={label(language, 'Datasource', '数据来源')}
        value="custom"
        disabled={disabled}
        options={[{ value: 'custom', label: label(language, 'Customized', '自定义') }]}
        onChange={() => updateContent({ datasource: 'custom', location: { mode: 'custom' } })}
      />
      <TextInput
        focusKey="contact-location-name"
        label={label(language, 'Location name', '地点名称')}
        value={locationName}
        disabled={disabled}
        onChange={updateLocationName}
      />
      <TextInput
        focusKey="contact-location-street-address"
        label={label(language, 'Street address', '街道地址')}
        value={streetAddress}
        disabled={disabled}
        onChange={updateStreetAddress}
      />
      <TextInput
        focusKey="contact-location-address-note"
        label={label(language, 'Address note', '地址补充')}
        value={locationAddress}
        disabled={disabled}
        onChange={updateLocationAddress}
      />
      <TextInput
        focusKey="contact-location-map-url"
        label={label(language, 'Google Maps link', 'Google Maps 链接')}
        value={mapUrl}
        disabled={disabled}
        onChange={(value) => updateContent({ mapUrl: value, linkUrl: value, ctaUrl: value, href: value })}
      />
      <TextInput
        focusKey="contact-location-map-embed-url"
        label={label(language, 'Map embed URL', '地图嵌入链接')}
        value={mapEmbedUrl}
        disabled={disabled}
        onChange={(value) => updateContent({ mapEmbedUrl: value, embedUrl: value })}
      />
      <TextInput
        focusKey="contact-location-open-map-label"
        label={label(language, 'Open map label', '打开地图文字')}
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
            fallback={label(language, 'Location name', '地点名称')}
            disabled={!editable}
            className="block"
            onChange={updateLocationName}
          />
        )}
        streetAddress={(
          <EditableText
            as="span"
            value={streetAddress}
            fallback={label(language, 'Street address', '街道地址')}
            disabled={!editable}
            className="block"
            onChange={updateStreetAddress}
          />
        )}
        locationAddress={(
          <EditableText
            as="span"
            value={locationAddress}
            fallback={label(language, 'Address note', '地址补充')}
            disabled={!editable}
            className="block"
            onChange={updateLocationAddress}
          />
        )}
        mapUrl={mapUrl}
        mapEmbedUrl={mapEmbedUrl}
        openMapLabel={(
          <EditableText
            as="span"
            value={openMapLabel}
            fallback={label(language, 'Open in Google Maps', '在 Google Maps 打开')}
            disabled={!editable}
            className="text-sm"
            onChange={updateOpenMapLabel}
          />
        )}
        mapPlaceholder={label(language, 'Add a map embed URL.', '请添加地图嵌入链接。')}
        onMapClick={mode === 'edit' ? (event) => event.preventDefault() : undefined}
      />
      {mode === 'edit' && showProperties ? renderProperties() : null}
    </>
  )
}

export default ContactLocationSection
