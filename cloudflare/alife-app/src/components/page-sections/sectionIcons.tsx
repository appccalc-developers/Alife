import { sectionIconsText } from '../../i18n/sectionIcons.ts'
import {
  Book,
  BookOpen,
  CalendarDays,
  Church,
  Cross,
  Handshake,
  Heart,
  Image,
  MapPin,
  Mic,
  Music,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react'
import type { LocalizedText, SectionIconKey } from '../../types'

export const sectionIconMap: Record<SectionIconKey, LucideIcon> = {
  church: Church,
  cross: Cross,
  calendar: CalendarDays,
  bible: BookOpen,
  people: Users,
  heart: Heart,
  music: Music,
  map: MapPin,
  image: Image,
  video: Video,
  mic: Mic,
  book: Book,
  handshake: Handshake,
}

export const sectionIconLabels: Record<SectionIconKey, LocalizedText> = sectionIconsText.sectionIconLabels

export const getSectionIcon = (key: SectionIconKey | undefined) => (key ? sectionIconMap[key] : undefined)

export const getSectionIconLabel = (key: SectionIconKey, language = 'en') => {
  const label = sectionIconLabels[key]
  return language === 'zh' ? label.zh : label.en
}
