import LandingHeroSection from './LandingHeroSection'
import CountdownSection from './CountdownSection'
import ContactLocationSection from './ContactLocationSection'
import SpotlightSection from './SpotlightSection'
import RichTextSection from './RichTextSection'
import GroupListSectionBlock from './GroupListSectionBlock'
import type { SectionComponentProps } from './types'
import { pageSectionShellClass } from './sectionPresets'

const SectionBlock = (props: SectionComponentProps) => {
  switch (props.section.type) {
    case 'LandingHero':
      return <LandingHeroSection {...props} />
    case 'Countdown':
      return <CountdownSection {...props} />
    case 'ContactLocation':
      return <ContactLocationSection {...props} />
    case 'Spotlight':
      return <SpotlightSection {...props} />
    case 'RichText':
      return <RichTextSection {...props} />
    case 'ListView':
      return <GroupListSectionBlock {...props} />
    default:
      return (
        <section id={props.domId} className={pageSectionShellClass}>
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
            {props.section.type || 'Unknown'} section configured.
          </div>
        </section>
      )
  }
}

export default SectionBlock
