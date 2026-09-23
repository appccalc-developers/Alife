import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import EventPermissionGuide from '../../src/views/admin/EventPermissionGuide'
import '../../src/styles/global.css'

function Fixture() {
  const [filter, setFilter] = useState('')
  const zh = new URLSearchParams(location.search).get('lang') === 'zh'
  return <MemoryRouter><main style={{ maxWidth: 1000, margin: '24px auto', padding: 12 }}><EventPermissionGuide zh={zh} onFilter={() => setFilter('admin.events.')} /><output aria-label="Permission filter">{filter}</output></main></MemoryRouter>
}
createRoot(document.getElementById('root')!).render(<Fixture />)
