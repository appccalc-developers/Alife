import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PageContentRenderer from '../components/page/PageContentRenderer'
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

  return (
    <section className="mx-auto w-full max-w-5xl space-y-4 px-3 sm:px-4">
      {loading ? <p className="rounded-lg border border-slate-200 bg-white p-3 text-slate-600">Loading page...</p> : null}
      {!loading && error ? <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">{error}</p> : null}

      {!loading && !error && page ? (
        <PageContentRenderer
          page={page}
          sections={sections}
          subgroupItems={subgroupItems}
          groupPageItems={groupPageItems}
          onEditPage={(pageId, groupId) => {
            navigate(`/pages/${pageId}/edit?groupId=${groupId}`)
          }}
        />
      ) : null}
    </section>
  )
}

export default PageView
