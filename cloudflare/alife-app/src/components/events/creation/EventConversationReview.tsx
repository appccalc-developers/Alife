import { eventConversationText as copy } from '../../../i18n/eventConversation'
import type { CreationDraft } from '../../../utils/eventCreationDraft'

export default function EventConversationReview({ draft, zh }: { draft: CreationDraft; zh: boolean }) {
  const locale = zh ? 'zh' : 'en'
  const text = (value: { en: string; zh: string }) => value[locale] || value.en || value.zh
  return <section className="ec-review" aria-label={copy.reviewTitle[locale]}>
    <header><img src="/event-companion/anhe-portrait.png" width={52} height={52} alt="" /><div><h2>{copy.reviewTitle[locale]}</h2><p>{copy.participants[locale]} · {draft.activityPlan?.participantCount ?? copy.pending[locale]}</p></div></header>
    <ol>{draft.activityPlan?.activities.map(project => <li key={project.id}><strong>{text(project.name)}</strong><p>{text(project.conditions)}</p></li>)}</ol>
    <p>{copy.reviewHelp[locale]}</p>
  </section>
}
