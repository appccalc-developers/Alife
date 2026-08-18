import { useQuery } from '@tanstack/react-query'
import { queryClient } from '../db/queryClient'
import { notificationService } from '../services/notificationService'
import { useAuthStore } from '../stores/auth'
import type { AppNotification } from '../types/notification'

export const currentTasksQueryKey = (memberId: string) => ['notifications', 'current', memberId] as const

export const useCurrentTasks = () => {
  const auth = useAuthStore()
  const memberId = auth.me?.id || ''

  return useQuery({
    queryKey: currentTasksQueryKey(memberId),
    queryFn: notificationService.getCurrentTasks,
    enabled: auth.initialized && !auth.loading && !auth.isGuest && Boolean(memberId),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000,
  })
}

export const invalidateCurrentTasks = async (memberId: string | undefined) => {
  if (!memberId) return
  await queryClient.invalidateQueries({ queryKey: currentTasksQueryKey(memberId) })
}

export const markCurrentTaskRead = async (memberId: string, notificationId: string) => {
  await notificationService.openNotification(notificationId)
  queryClient.setQueryData<AppNotification[]>(currentTasksQueryKey(memberId), (current) =>
    current?.filter((task) => task.id !== notificationId) ?? [])
  await invalidateCurrentTasks(memberId)
}
