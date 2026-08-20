import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Images, Settings2 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import ChurchGroupFilter from '../components/church-life/ChurchGroupFilter'
import ChurchLifeResultsRegion from '../components/church-life/ChurchLifeResultsRegion'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageShell from '../components/layout/AppPageShell'
import { churchLifeQueryKeys, churchLifeService, type ChurchLifeGroup } from '../services/churchLifeService'
import { resolveFileAssetAccessUrl } from '../services/fileAssetService'
import { normalizeApiError } from '../services/http'
import { useAuthStore } from '../stores/auth'
import { localizeText } from '../utils/localizedText'
import { churchGroupPath, updateChurchLifeOwnerFilter } from '../utils/churchLifeGroups'

const ChurchAlbumsView = () => {
  const auth = useAuthStore()
  const language = auth.language
  const viewerId = auth.me?.id ?? 'member'
  const [searchParams, setSearchParams] = useSearchParams()
  const ownerGroupId = searchParams.get('ownerGroupId')?.trim() ?? ''
  const albumsQuery = useQuery({
    queryKey: churchLifeQueryKeys.content('albums', viewerId, ownerGroupId || undefined),
    queryFn: () => churchLifeService.listAlbums(ownerGroupId || undefined),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
  const [retainedGroups, setRetainedGroups] = useState<ChurchLifeGroup[]>([])
  const groups = albumsQuery.data?.groups ?? retainedGroups

  useEffect(() => {
    if (albumsQuery.data?.groups) setRetainedGroups(albumsQuery.data.groups)
  }, [albumsQuery.data?.groups])

  const selectOwnerGroup = (nextOwnerGroupId: string) => {
    setSearchParams(updateChurchLifeOwnerFilter(searchParams, nextOwnerGroupId), { preventScrollReset: true })
  }

  return (
    <AppPageShell
      title={language === 'zh' ? '教会相册' : 'Church albums'}
      subtitle={language === 'zh' ? '浏览教会及所有开放下属事工的顶层相册；子相册仍在实际所属组中展开。' : 'Browse top-level albums from the church and every open descendant ministry; subalbums continue inside the actual owning group.'}
      actions={<ChurchGroupFilter groups={groups} value={ownerGroupId} language={language} onChange={selectOwnerGroup} />}
    >
      <ChurchLifeResultsRegion busy={albumsQuery.isFetching && !albumsQuery.isPending} language={language}>
        {albumsQuery.isPending ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-72 animate-pulse rounded-2xl border border-[#dfe7e3] bg-white" />)}</div> : null}
        {albumsQuery.error ? <AppEmptyState title={language === 'zh' ? '无法加载相册' : 'Albums could not be loaded'} description={normalizeApiError(albumsQuery.error).message} actionLabel={language === 'zh' ? '重试' : 'Retry'} onAction={() => void albumsQuery.refetch()} /> : null}
        {!albumsQuery.isPending && !albumsQuery.error && albumsQuery.data?.items.length === 0 ? <AppEmptyState title={language === 'zh' ? '没有符合条件的相册' : 'No matching albums'} description={language === 'zh' ? '更换所属组筛选，或稍后再来查看。' : 'Choose another owning group or check again later.'} /> : null}
        {!albumsQuery.isPending && !albumsQuery.error && albumsQuery.data?.items.length ? (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {albumsQuery.data.items.map((album) => {
              const owner = groups.find((group) => group.id === album.groupId)
              return (
                <article key={album.id} className="overflow-hidden rounded-2xl border border-[#2f4b42]/10 bg-white shadow-sm">
                  <Link to={`/groups/${encodeURIComponent(album.groupId)}/albums/${encodeURIComponent(album.id)}`} className="group block">
                    <div className="aspect-[4/3] overflow-hidden bg-[#e3f0eb]">
                      {album.coverUrl ? <img src={resolveFileAssetAccessUrl(album.coverUrl) ?? album.coverUrl} alt={localizeText(album.name, language)} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" /> : <div className="flex h-full items-center justify-center text-[#176b5a]"><Images className="h-12 w-12" aria-hidden="true" /></div>}
                    </div>
                    <div className="p-4">
                      <span className="inline-flex max-w-full rounded-full bg-[#e7f2ed] px-2.5 py-1 text-[0.65rem] font-black text-[#176b5a]"><span className="truncate">{churchGroupPath(album.groupId, groups, language)}</span></span>
                      <h2 className="mt-3 font-black text-[#18332d] group-hover:text-[#176b5a]">{localizeText(album.name, language)}</h2>
                      <p className="mt-1 text-xs text-[#66766f]">{language === 'zh' ? `${album.childCount} 个子相册 · ${album.photoCount} 张图片` : `${album.childCount} subalbums · ${album.photoCount} photos`}</p>
                    </div>
                  </Link>
                  {owner?.canManage ? <div className="border-t border-[#e5ebe8] px-4 py-3"><Link className="inline-flex items-center gap-1 text-xs font-black text-[#176b5a]" to={`/groups/${encodeURIComponent(album.groupId)}/manage?section=albums`}><Settings2 className="h-3.5 w-3.5" />{language === 'zh' ? '在所属组管理' : 'Manage in owning group'}</Link></div> : null}
                </article>
              )
            })}
          </section>
        ) : null}
      </ChurchLifeResultsRegion>
    </AppPageShell>
  )
}

export default ChurchAlbumsView
