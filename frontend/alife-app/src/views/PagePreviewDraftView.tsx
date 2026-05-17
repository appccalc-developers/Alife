import GroupPagePreview from '../components/page-editor/GroupPagePreview'
import type { SectionEditModel } from '../types/page-editor'

type DraftPayload = {
  title: string
  description: string
  slug: string
  visibility: string
  sections: SectionEditModel[]
  createdAt: number
}

const PagePreviewDraftView = () => {
  const raw = window.localStorage.getItem('page-editor-preview-draft')
  if (!raw) {
    return <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">No draft preview found. Open preview from editor page.</p>
  }

  let payload: DraftPayload | null = null
  try {
    payload = JSON.parse(raw) as DraftPayload
  } catch {
    payload = null
  }

  if (!payload) {
    return <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">Invalid preview payload.</p>
  }

  return (
    <section className="mx-auto max-w-5xl space-y-3">
      <p className="text-xs text-slate-500">Draft preview (not yet saved)</p>
      <GroupPagePreview
        title={payload.title}
        description={payload.description}
        slug={payload.slug}
        visibility={payload.visibility}
        sections={payload.sections}
      />
    </section>
  )
}

export default PagePreviewDraftView
