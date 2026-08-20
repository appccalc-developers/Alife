export const belongsToForumRouteScope = (
  scopedGroupId: string,
  postGroupId?: string | null,
) => scopedGroupId ? postGroupId === scopedGroupId : !postGroupId
