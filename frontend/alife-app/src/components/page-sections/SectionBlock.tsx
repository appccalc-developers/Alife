import HeroSection from './HeroSection'
import MediaSpotlightSection from './MediaSpotlightSection'
import IconFeatureGridSection from './IconFeatureGridSection'
import SermonSpotlightSection from './SermonSpotlightSection'
import RichTextSection from './RichTextSection'
import GroupListSectionBlock from './GroupListSectionBlock'
import PostFeedSection from './PostFeedSection'
import SermonSection from './SermonSection'
import type { SectionComponentProps } from './types'

const SectionBlock = (props: SectionComponentProps) => {
  switch (props.section.type) {
    case 'Hero':
      return <HeroSection {...props} />
    case 'MediaSpotlight':
      return <MediaSpotlightSection {...props} />
    case 'IconFeatureGrid':
      return <IconFeatureGridSection {...props} />
    case 'SermonSpotlight':
      return <SermonSpotlightSection {...props} />
    case 'RichText':
      return <RichTextSection {...props} />
    case 'ListView':
      return <GroupListSectionBlock {...props} />
    case 'PostFeed':
      return <PostFeedSection {...props} />
    case 'Sermon':
      return <SermonSection {...props} />
    default:
      return (
        <section className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
          {props.section.type || 'Unknown'} section configured.
        </section>
      )
  }
}

export default SectionBlock
