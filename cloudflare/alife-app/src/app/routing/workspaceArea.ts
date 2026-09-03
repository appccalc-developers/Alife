export type WorkspaceArea = 'member' | 'system'

export const getWorkspaceArea = (pathname: string): WorkspaceArea =>
  pathname === '/admin' || pathname.startsWith('/admin/') ? 'system' : 'member'
