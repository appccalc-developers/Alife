import type { AppNotification } from '../types/notification'

export const PERSONAL_CENTER_TASK_LIMIT = 3

export type PersonalCenterPrimaryAction = 'urgent' | 'general' | 'continue-study' | 'start-study'

export const selectPersonalCenterTasks = (
  tasks: AppNotification[],
  limit = PERSONAL_CENTER_TASK_LIMIT,
) => [...tasks]
  .sort((left, right) => {
    if (left.category === right.category) {
      return Date.parse(right.createdUtc || '') - Date.parse(left.createdUtc || '')
    }
    return left.category === 'urgent' ? -1 : 1
  })
  .slice(0, Math.max(0, limit))

export const getPersonalCenterPrimaryAction = ({
  urgentCount,
  generalCount,
  hasReadingProgress,
}: {
  urgentCount: number
  generalCount: number
  hasReadingProgress: boolean
}): PersonalCenterPrimaryAction => {
  if (urgentCount > 0) return 'urgent'
  if (generalCount > 0) return 'general'
  return hasReadingProgress ? 'continue-study' : 'start-study'
}
