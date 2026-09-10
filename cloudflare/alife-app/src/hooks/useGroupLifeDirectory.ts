import { useQuery } from '@tanstack/react-query'
import { fetchFreshVisibleGroupsForViewer } from '../db/collections/groupCollection'
import { useAuthStore } from '../stores/auth'

export const useGroupLifeDirectory = () => {
  const auth = useAuthStore()
  return useQuery({
    queryKey: ['group-life-directory', 'v2', auth.me?.id ?? 'guest'],
    queryFn: () => fetchFreshVisibleGroupsForViewer(auth.me?.id),
    enabled: auth.initialized,
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  })
}
