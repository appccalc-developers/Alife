export const belongsToForumRouteScope = (
  churchForum: boolean,
  scopedGroupId: string,
  postGroupId?: string | null,
) => churchForum || !scopedGroupId || postGroupId === scopedGroupId
