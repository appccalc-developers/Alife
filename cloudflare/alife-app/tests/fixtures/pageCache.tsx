// Synthetic cache regression harness; never included in production entrypoints.
import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '../../src/db/queryClient'
import { AuthProvider, useAuthStore } from '../../src/stores/auth'
import PageView from '../../src/views/PageView'
import PageEditorView from '../../src/views/PageEditorView'
import GroupPageTabs from '../../src/components/group/GroupPageTabs'
import { pageService } from '../../src/services/pageService'
import type { GroupPageDto } from '../../src/types/group'
import '../../src/styles/global.css'

const pageId = '11111111-1111-1111-1111-111111111111'
const groupId = '22222222-2222-2222-2222-222222222222'
const summary = { id: pageId, ownerGroupId: groupId, createdByMemberId: 'A', title: { en: 'Fixture', zh: '测试' }, description: {}, tagsJson: '[]', titleDisplayStyle: 'Default', visibility: 'draft', sections: [] } as unknown as GroupPageDto
const mode = new URLSearchParams(location.search).get('mode') ?? 'view'

function Fixture() {
  const auth = useAuthStore()
  const [status, setStatus] = useState('')
  useEffect(() => {
    if (!auth.initialized && !auth.loading) void auth.bootstrap().catch(() => undefined)
  }, [auth.initialized, auth.loading, auth.bootstrap])
  return <>
    <nav>
      <button onClick={() => void auth.fetchMe().catch(() => undefined)}>Load account</button>
      <button onClick={() => void auth.updateLanguage(auth.language === 'en' ? 'zh' : 'en')}>Switch language</button>
      <button onClick={() => void auth.logout().catch(() => undefined)}>Log out</button>
      <button onClick={() => void pageService.deletePage(pageId, groupId).then(() => setStatus('deleted')).catch(() => setStatus('delete failed'))}>Delete fixture page</button>
      <output aria-label="Viewer">{auth.me?.id ?? 'anonymous'}</output><output aria-label="Status">{status}</output>
    </nav>
    {auth.initialized ? mode === 'tabs'
      ? <GroupPageTabs pages={[summary]} subgroups={[]} canViewWorkingCopy onCreate={() => {}} />
      : <Routes><Route path="/pages/:pageId" element={<PageView />} /><Route path="/pages/:pageId/edit" element={<PageEditorView />} /></Routes>
      : <p>Loading fixture</p>}
  </>
}

createRoot(document.getElementById('root')!).render(
  <QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[`/pages/${pageId}${mode === 'editor' ? '/edit' : mode === 'review' ? '?fromReview=true' : ''}`]}>
    <AuthProvider><Fixture /></AuthProvider>
  </MemoryRouter></QueryClientProvider>,
)
