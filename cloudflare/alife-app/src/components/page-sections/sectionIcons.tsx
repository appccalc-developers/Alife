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
import type { SectionIconKey } from '../../types'

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

export const getSectionIcon = (key: SectionIconKey | undefined) => (key ? sectionIconMap[key] : undefined)
