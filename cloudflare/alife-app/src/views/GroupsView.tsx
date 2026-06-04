import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from '@tanstack/react-db'
import { churchQueryKey } from '../db/collections/groupCollection'
import { subgroupsCollection } from '../db/collections/groupCollection'
import { conditionalGet } from '../db/httpCache'
import { useUiText } from '../i18n/uiText'
import { useAuthStore } from '../stores/auth'
import type { GroupDto } from '../types'
import { normalizeGroup } from '../utils/apiEnums'
import { localizeText } from '../utils/localizedText'

const GroupsView = () => {
  const t = useUiText()
  const { language } = useAuthStore()
  const [church, setChurch] = useState<GroupDto | null>(null)
  const [loadingChurch, setLoadingChurch] = useState(true)

  // Load the church group as a single object via conditionalGet.
  useEffect(() => {
    let cancelled = false
    setLoadingChurch(true)
    conditionalGet<GroupDto>({
          queryKey: churchQueryKey,
      path: '/api/groups/church',
    })
      .then((data) => {
        if (!cancelled) setChurch(normalizeGroup(data))
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoadingChurch(false)
      })
    return () => { cancelled = true }
  }, [])

  // Load subgroups as a collection through useLiveQuery.
  const collection = useMemo(
    () => (church?.id ? subgroupsCollection(church.id) : null),
    [church?.id],
  )
  const { data: subgroups } = useLiveQuery(collection as NonNullable<typeof collection>)

  if (loadingChurch) {
    return (
      <section className="space-y-4">
        <div className="h-8 w-56 animate-pulse rounded bg-slate-200" />
      </section>
    )
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">{t('groups')}</h1>
      {church ? (
        <article className="rounded-xl border bg-white p-4">
          <h2 className="text-xl font-semibold">{localizeText(church.name, language)}</h2>
          {localizeText(church.description, language) ? (
            <p className="mt-1 text-sm text-slate-600">{localizeText(church.description, language)}</p>
          ) : null}
          <Link className="text-blue-600" to={`/groups/${church.id}`}>
            {t('openChurch')}
          </Link>
        </article>
      ) : null}
      <div className="grid gap-3 md:grid-cols-2">
        {(subgroups ?? []).map((group) => (
          <article key={group.id} className="rounded-xl border bg-white p-4">
            <h3 className="font-semibold">{localizeText(group.name, language)}</h3>
            {localizeText(group.description, language) ? (
              <p className="text-sm text-slate-600">{localizeText(group.description, language)}</p>
            ) : null}
            <p className="text-sm text-slate-600">{t(group.accessType)}</p>
            <Link className="text-blue-600" to={`/groups/${group.id}`}>
              {t('details')}
            </Link>
          </article>
        ))}
      </div>
    </section>
  )
}

export default GroupsView
