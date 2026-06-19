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

export const sectionIconLabels: Record<SectionIconKey, LocalizedText> = {
  church: { en: 'Church', zh: '教会' },
  cross: { en: 'Cross', zh: '十字架' },
  calendar: { en: 'Calendar', zh: '日历' },
  bible: { en: 'Bible', zh: '圣经' },
  people: { en: 'People', zh: '人群' },
  heart: { en: 'Heart', zh: '爱心' },
  music: { en: 'Music', zh: '音乐' },
  map: { en: 'Map', zh: '地图' },
  image: { en: 'Image', zh: '图片' },
  video: { en: 'Video', zh: '视频' },
  mic: { en: 'Mic', zh: '麦克风' },
  book: { en: 'Book', zh: '书籍' },
  handshake: { en: 'Handshake', zh: '握手' },
}

export const getSectionIcon = (key: SectionIconKey | undefined) => (key ? sectionIconMap[key] : undefined)

export const getSectionIconLabel = (key: SectionIconKey, language = 'en') => {
  const label = sectionIconLabels[key]
  return language === 'zh' ? label.zh : label.en
}
