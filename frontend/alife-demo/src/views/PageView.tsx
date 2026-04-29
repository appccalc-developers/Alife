import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PagePreview from '../components/page/PagePreview'
import { groupService } from '../api/groupService'
import { pageService } from '../services/pageService'
import { useAuthStore } from '../stores/auth'
import type { GroupPageDto } from '../types/group'
import type { SectionEditModel } from '../types/page-editor'

const PageView = () => {
  const { slug = '' } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const auth = useAuthStore()

  const [page, setPage] = useState<GroupPageDto | null>(null)
  const [sections, setSections] = useState<SectionEditModel[]>([])
  const [subgroupItems, setSubgroupItems] = useState<Array<{ id: string; name: string; accessType: string }>>([])
  const [groupPageItems, setGroupPageItems] = useState<Array<{ id: string; title: string; slug: string; visibility: string }>>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    if (!slug) {
      return
    }

    setLoading(true)
    setError('')

    try {
      const nextPage = await groupService.getPageBySlug(slug, auth.language)
      setPage(nextPage)

      const nextSections = nextPage?.id ? await pageService.getPageSections(nextPage.id) : []
      setSections(nextSections)

      if (nextPage?.ownerGroupId) {
        const [subgroups, pages] = await Promise.all([
          groupService.getSubgroups(nextPage.ownerGroupId),
          groupService.getGroupPages(nextPage.ownerGroupId, auth.language),
        ])
        setSubgroupItems(subgroups)
        setGroupPageItems(pages)
      } else {
        setSubgroupItems([])
        setGroupPageItems([])
      }
    } catch {
      setError('Page not found or not accessible for your membership.')
      setSections([])
      setSubgroupItems([])
      setGroupPageItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load().catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, auth.language])

  const sectionItems = useMemo(() => sections, [sections])

  return (
    <section className="mx-auto max-w-3xl space-y-4">
      {loading ? <p className="rounded-lg border border-slate-200 bg-white p-3 text-slate-600">Loading page...</p> : null}
      {!loading && error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</p> : null}

      {!loading && !error && page ? (
        <PagePreview
          page={page}
          sections={sectionItems}
          subgroupItems={subgroupItems}
          groupPageItems={groupPageItems}
          onEdit={
            page.ownerGroupId
              ? () => {
                  navigate(`/pages/${page.id}/edit?groupId=${page.ownerGroupId}`)
                }
              : undefined
          }
        />
      ) : null}
    </section>
  )
}

export default PageView
