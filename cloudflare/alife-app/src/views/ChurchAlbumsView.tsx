import { churchAlbumsViewText } from '../i18n/churchAlbumsView.ts'
import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Images, Settings2 } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { useChurchSiteGroups } from '../components/church-life/ChurchSiteLayout'
import ChurchLifeResultsRegion from '../components/church-life/ChurchLifeResultsRegion'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppOverflowMenu from '../components/layout/AppOverflowMenu'
import AppPageShell from '../components/layout/AppPageShell'
import { churchLifeQueryKeys, churchLifeService, type ChurchLifeGroup } from '../services/churchLifeService'
import { resolveFileAssetAccessUrl } from '../services/fileAssetService'
import { normalizeApiError } from '../services/http'
import { useAuthStore } from '../stores/auth'
import { localizeText } from '../utils/localizedText'
import { churchGroupPath } from '../utils/churchLifeGroups'

const ChurchAlbumsView = () => {
  const auth = useAuthStore()
  const language = auth.language
  const viewerId = auth.me?.id ?? 'member'
  const [searchParams] = useSearchParams()
  const ownerGroupId = searchParams.get('ownerGroupId')?.trim() ?? ''
  const albumsQuery = useQuery({
    queryKey: churchLifeQueryKeys.content('albums', viewerId, ownerGroupId || undefined),
    queryFn: () => churchLifeService.listAlbums(ownerGroupId || undefined),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  })
  useChurchSiteGroups(albumsQuery.data?.groups)
  const [retainedGroups, setRetainedGroups] = useState<ChurchLifeGroup[]>([])
  const groups = albumsQuery.data?.groups ?? retainedGroups

  useEffect(() => {
    if (albumsQuery.data?.groups) setRetainedGroups(albumsQuery.data.groups)
  }, [albumsQuery.data?.groups])


  return (
    <AppPageShell
      title={language === 'zh' ? churchAlbumsViewText.churchAlbums.zh : churchAlbumsViewText.churchAlbums.en}
      context={language === 'zh' ? churchAlbumsViewText.churchLifeAlbums.zh : churchAlbumsViewText.churchLifeAlbums.en}
      subtitle={language === 'zh' ? churchAlbumsViewText.exploreChurchAndMinistryAlbumsAndRevisitMomentsShared.zh : churchAlbumsViewText.exploreChurchAndMinistryAlbumsAndRevisitMomentsShared.en}
    >
      <ChurchLifeResultsRegion busy={albumsQuery.isFetching && !albumsQuery.isPending} language={language}>
        {albumsQuery.isPending ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-72 animate-pulse rounded-2xl border border-[#dfe7e3] bg-white" />)}</div> : null}
        {albumsQuery.error ? <AppEmptyState title={language === 'zh' ? churchAlbumsViewText.albumsCouldNotBeLoaded.zh : churchAlbumsViewText.albumsCouldNotBeLoaded.en} description={normalizeApiError(albumsQuery.error).message} actionLabel={language === 'zh' ? churchAlbumsViewText.retry.zh : churchAlbumsViewText.retry.en} onAction={() => void albumsQuery.refetch()} /> : null}
        {!albumsQuery.isPending && !albumsQuery.error && albumsQuery.data?.items.length === 0 ? <AppEmptyState title={language === 'zh' ? churchAlbumsViewText.noMatchingAlbums.zh : churchAlbumsViewText.noMatchingAlbums.en} description={language === 'zh' ? churchAlbumsViewText.chooseAnotherOwningGroupOrCheckAgainLater.zh : churchAlbumsViewText.chooseAnotherOwningGroupOrCheckAgainLater.en} /> : null}
        {!albumsQuery.isPending && !albumsQuery.error && albumsQuery.data?.items.length ? (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {albumsQuery.data.items.map((album) => {
              const owner = groups.find((group) => group.id === album.groupId)
              return (
                <article key={album.id} className="overflow-hidden rounded-2xl border border-[#2f4b42]/10 bg-white shadow-sm">
                  <Link to={`/church/groups/${encodeURIComponent(album.groupId)}/albums/${encodeURIComponent(album.id)}`} className="group block">
                    <div className="aspect-[4/3] overflow-hidden bg-[#e3f0eb]">
                      {album.coverUrl ? <img src={resolveFileAssetAccessUrl(album.coverUrl) ?? album.coverUrl} alt={localizeText(album.name, language)} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" /> : <div className="flex h-full items-center justify-center text-[#176b5a]"><Images className="h-12 w-12" aria-hidden="true" /></div>}
                    </div>
                    <div className="p-4">
                      <span className="inline-flex max-w-full rounded-full bg-[#e7f2ed] px-2.5 py-1 text-[0.65rem] font-black text-[#176b5a]"><span className="truncate">{churchGroupPath(album.groupId, groups, language)}</span></span>
                      <h2 className="mt-3 font-black text-[#18332d] group-hover:text-[#176b5a]">{localizeText(album.name, language)}</h2>
                      <p className="mt-1 text-xs text-[#66766f]">{language === 'zh' ? churchAlbumsViewText.subalbumsPhotos.zh(album.childCount, album.photoCount) : churchAlbumsViewText.subalbumsPhotos.en(album.childCount, album.photoCount)}</p>
                    </div>
                  </Link>
                  {owner?.canManage ? (
                    <div className="flex justify-end border-t border-[#e5ebe8] px-3 py-2">
                      <AppOverflowMenu
                        label={language === 'zh' ? churchAlbumsViewText.moreActions.zh : churchAlbumsViewText.moreActions.en}
                        actions={[{
                          label: language === 'zh' ? churchAlbumsViewText.manageInOwningGroup.zh : churchAlbumsViewText.manageInOwningGroup.en,
                          to: `/groups/${encodeURIComponent(album.groupId)}/manage?section=albums`,
                          icon: <Settings2 className="h-4 w-4" />,
                        }]}
                      />
                    </div>
                  ) : null}
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
