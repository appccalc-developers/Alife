// Synthetic content only; browser tests intercept every API request.
import { useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuthStore } from '../../src/stores/auth'
import HomeNavHeader from '../../src/views/home/HomeNavHeader'
import PageReviewView from '../../src/views/PageReviewView'
import { getCopy } from '../../src/views/home/homeCopy'
import '../../src/styles/global.css'

const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
const review = new URLSearchParams(window.location.search).get('mode') === 'review'

function Fixture() {
  const auth = useAuthStore()
  const location = useLocation()
  const zh = auth.language === 'zh'
  const copy = getCopy(auth.language, '')
  useEffect(() => { if (review) void auth.bootstrap() }, [auth.bootstrap])
  return <>
    {review ? auth.initialized ? <main className="alife-workspace" style={{ padding: '1rem', minHeight: '100vh' }}><PageReviewView /></main> : null : <>
      <HomeNavHeader copy={copy} language={auth.language} navItems={[{
        key: 'fixture-groups', label: copy.nav.groups,
        items: Array.from({ length: 30 }, (_, index) => ({
          to: `/fixture/page-${index + 1}`,
          label: `${zh ? '示例小组' : 'Example group'} ${String(index + 1).padStart(2, '0')}`,
        })),
      }]} />
      <main style={{ minHeight: '140vh', padding: '7rem 2rem', background: 'linear-gradient(145deg, #204f43, #9caa8d)', color: 'white' }}>
        <h1>Long-menu regression fixture</h1><p>Synthetic content only</p>
      </main>
    </>}
    <output aria-label="Fixture route" style={{ position: 'fixed', bottom: 0, pointerEvents: 'none' }}>{location.pathname}</output>
  </>
}

createRoot(document.getElementById('root')!).render(<QueryClientProvider client={client}><AuthProvider><MemoryRouter><Fixture /></MemoryRouter></AuthProvider></QueryClientProvider>)
