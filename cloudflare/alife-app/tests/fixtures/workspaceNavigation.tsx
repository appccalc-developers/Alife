import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { User } from 'lucide-react'
import { AuthProvider, useAuthStore } from '../../src/stores/auth'
import { BottomNavigation, DesktopNavigation } from '../../src/app/navigation/AppNavigation'
import AppPageShell from '../../src/components/layout/AppPageShell'
import AppSectionCard from '../../src/components/layout/AppSectionCard'
import AppActionButton from '../../src/components/layout/AppActionButton'
import LanguageSelector from '../../src/components/i18n/LanguageSelector'
import OnboardingView from '../../src/views/OnboardingView'
import { setUnsavedChangesGuard } from '../../src/utils/unsavedChangesGuard'
import '../../src/styles/global.css'

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
function Fixture() {
  const auth = useAuthStore(), location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [guarded, setGuarded] = useState(false)
  const zh = auth.language === 'zh'
  const onboarding = new URLSearchParams(window.location.search).get('mode') === 'onboarding'
  const copy = { alife: 'ALIFE', collapse: zh ? '收起' : 'Collapse', expand: zh ? '展开' : 'Expand', menu: 'Menu', openMenu: 'Open menu', closeMenu: 'Close menu', communityWorkspace: 'Community', platformWorkspace: 'Platform', contentWorkspace: 'Content', currentSpace: 'Current', pagesSection: 'Pages', eventsSection: 'Events', accountSection: 'Account' }
  const section = { key: 'account', label: zh ? '个人中心' : 'Personal Center', to: '/profile', mobileDirectLink: true, icon: <User />, items: [{ key: 'profile', to: '/profile', label: zh ? '个人中心' : 'Personal Center', icon: <User /> }] }
  return <div className="alife-workspace min-h-screen pb-32">
    {onboarding ? <OnboardingView /> : <>
      <DesktopNavigation collapsed={collapsed} onToggle={() => setCollapsed(!collapsed)} workspaceVisible workspaceSections={[section]} platformSections={[]} copy={copy} />
      <main className={`p-3 desktop:pl-80 ${collapsed ? 'desktop:!pl-24' : ''}`}>
        <LanguageSelector language={auth.language} onChange={auth.updateLanguage} />
        <AppPageShell title={zh ? '示例工作页面' : 'Example workspace'} context={zh ? '小组生活' : 'Group Life'} backLink={{ to: '/groups', label: zh ? '返回小组' : 'Back to group' }} overflowLabel="Fixture actions" overflowActions={[{ label: 'Fixture action', onSelect: () => { document.body.dataset.fixtureAction = 'done' } }]}>
          <AppSectionCard title={zh ? '当前事项' : 'Current work'}><p>{zh ? '仅使用测试数据' : 'Synthetic data only'}</p><AppActionButton onClick={() => { setUnsavedChangesGuard(!guarded, 'Unsaved fixture'); setGuarded(!guarded) }}>{guarded ? 'Clear guard' : 'Enable guard'}</AppActionButton></AppSectionCard>
        </AppPageShell>
      </main>
      <BottomNavigation sections={[section]} copy={copy} />
    </>}
    <output aria-label="Fixture route">{location.pathname}</output>
  </div>
}
createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><AuthProvider><MemoryRouter initialEntries={['/workspace']}><Fixture /></MemoryRouter></AuthProvider></QueryClientProvider>)
