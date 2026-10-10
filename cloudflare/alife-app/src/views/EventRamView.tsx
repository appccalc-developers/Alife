import { eventRamViewText } from '../i18n/eventRamView.ts'
import { useParams, useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../stores/auth'
import AppPageShell from '../components/layout/AppPageShell'
import EventRamWorkspace from '../components/events/EventRamWorkspace'
export default function EventRamView() {
  const { eventId } = useParams()
  const [searchParams] = useSearchParams()
  const { language } = useAuthStore()
  const zh = language === 'zh'
  const source = searchParams.get('from')
  const backLink = source === 'profile'
    ? { to: '/profile', label: zh ? eventRamViewText.backToPersonalCenter.zh : eventRamViewText.backToPersonalCenter.en }
    : source === 'church'
      ? { to: '/church?section=ram-reviews', label: zh ? eventRamViewText.backToChurchLife.zh : eventRamViewText.backToChurchLife.en }
      : { to: `/events/${eventId}`, label: zh ? eventRamViewText.backToEvent.zh : eventRamViewText.backToEvent.en }
  return <AppPageShell
    title={zh ? eventRamViewText.independentRamReview.zh : eventRamViewText.independentRamReview.en}
    subtitle={zh ? eventRamViewText.eventPreparationReviewTheCompleteEventPlanAndRam.zh : eventRamViewText.eventPreparationReviewTheCompleteEventPlanAndRam.en}
    backLink={backLink}
  >{eventId ? <EventRamWorkspace eventId={eventId} language={language} showEventPlan /> : null}</AppPageShell>
}
