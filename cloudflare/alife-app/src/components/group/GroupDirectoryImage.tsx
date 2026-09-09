import { useQuery } from '@tanstack/react-query'
import { groupService } from '../../services/groupService'
import { pageService } from '../../services/pageService'
import { useAuthStore } from '../../stores/auth'
import { readGroupDisplayImage } from '../../utils/groupDirectory'

const fallbackImage = '/media/alife-groups.jpg'

const GroupDirectoryImage = ({ groupId, groupName }: { groupId: string; groupName: string }) => {
  const auth = useAuthStore()
  const query = useQuery({
    queryKey: ['group-directory-image', groupId, auth.me?.id ?? 'guest'],
    queryFn: async () => {
      const pages = await groupService.getGroupPages(groupId)
      if (!pages[0]?.id) return fallbackImage
      const page = await pageService.getPageById(pages[0].id)
      return readGroupDisplayImage(page) || fallbackImage
    },
    staleTime: 30_000,
    retry: false,
  })

  return <img src={query.data || fallbackImage}
    alt={auth.language === 'zh' ? `${groupName}展示图片` : `${groupName} display picture`}
    width={224} height={144} loading="lazy"
    className="h-36 w-56 max-w-full shrink-0 rounded-xl bg-[#e3f0eb] object-cover"
    onError={event => {
      if (!event.currentTarget.src.endsWith(fallbackImage)) event.currentTarget.src = fallbackImage
    }} />
}

export default GroupDirectoryImage
