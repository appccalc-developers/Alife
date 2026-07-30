import LocationSectionPresentation from '../../components/location/LocationSectionPresentation'
import { churchMapEmbedUrl, churchMapUrl } from './homeUtils'
import {
  defaultContactLocationStreetAddress,
  defaultLocationInquiryContactName,
  defaultLocationInquiryContactPhone,
} from '../../utils/contactLocation'
import type { HomeCopy } from './homeCopy'

type Props = {
  copy: HomeCopy
}

const LocationSection = ({ copy }: Props) => (
  <LocationSectionPresentation
    locationTitle={copy.locationTitle}
    locationName={copy.locationName}
    streetAddress={defaultContactLocationStreetAddress}
    locationAddress={copy.locationAddress}
    contactName={defaultLocationInquiryContactName}
    contactNameLabel={copy.locationContactNameLabel}
    contactPhone={defaultLocationInquiryContactPhone}
    contactPhoneLabel={copy.locationContactPhoneLabel}
    mapUrl={churchMapUrl}
    mapEmbedUrl={churchMapEmbedUrl}
    openMapLabel={copy.openMap}
  />
)

export default LocationSection
