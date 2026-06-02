import type { ComponentType } from 'react'
import HeroSection from './HeroSection'
import MediaSpotlightSection from './MediaSpotlightSection'
import IconFeatureGridSection from './IconFeatureGridSection'
import SermonSpotlightSection from './SermonSpotlightSection'
import RichTextSection from './RichTextSection'
import GroupListSectionBlock from './GroupListSectionBlock'
import PostFeedSection from './PostFeedSection'
import SermonSection from './SermonSection'
import type { SectionComponentProps } from './types'
import type { SectionType } from '../../types/page-editor'

const sectionComponents: Record<SectionType, ComponentType<SectionComponentProps>> = {
  Hero: HeroSection,
  MediaSpotlight: MediaSpotlightSection,
  IconFeatureGrid: IconFeatureGridSection,
  SermonSpotlight: SermonSpotlightSection,
  RichText: RichTextSection,
  ListView: GroupListSectionBlock,
  PostFeed: PostFeedSection,
  Sermon: SermonSection,
}

const SectionBlock = (props: SectionComponentProps) => {
  const SectionComponent = props.section.type ? sectionComponents[props.section.type] : undefined

  if (SectionComponent) {
    return <SectionComponent {...props} />
  }

  return (
    <section className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
      {props.section.type || 'Unknown'} section configured.
    </section>
  )
}

export default SectionBlock
