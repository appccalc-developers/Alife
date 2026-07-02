import LocationSectionPresentation from '../../components/location/LocationSectionPresentation'
import { churchMapEmbedUrl, churchMapUrl } from './homeUtils'
import { defaultContactLocationStreetAddress } from '../../utils/contactLocation'
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
    mapUrl={churchMapUrl}
    mapEmbedUrl={churchMapEmbedUrl}
    openMapLabel={copy.openMap}
  />
)

export default LocationSection
