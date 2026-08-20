import { queryClient } from '../db/queryClient.ts'
import { churchLifeQueryKeys, forumQueryKeys } from './contentQueryKeys.ts'

export const invalidateForumPostQueries = async (postId: string) => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: forumQueryKeys.postScope(postId) }),
    queryClient.invalidateQueries({ queryKey: churchLifeQueryKeys.all }),
  ])
}
