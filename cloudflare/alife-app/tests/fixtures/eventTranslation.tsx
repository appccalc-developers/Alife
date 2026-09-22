import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthProvider, useAuthStore } from '../../src/stores/auth'
import DetailsWorkspace from '../../src/components/events/creation/DetailsWorkspace'
import { DetailsBilingualField } from '../../src/components/events/creation/DetailsStep'
import '../../src/styles/global.css'

function Fixture() {
  const { fetchMe, me, language } = useAuthStore()
  const [value, setValue] = useState({ en: 'Community dinner', zh: '社区聚餐' })
  const [readOnly, setReadOnly] = useState(false)
  useEffect(() => { void fetchMe() }, [fetchMe])
  if (!me) return <p>Loading fixture</p>
  return <main style={{ maxWidth: 1000, margin: '24px auto', padding: 12 }}>
    <button type="button" onClick={() => setReadOnly(current => !current)}>Toggle read-only fixture</button>
    <DetailsWorkspace zh={language === 'zh'} active readOnly={readOnly} assistant={() => null}
      form={<DetailsBilingualField field="title" label={language === 'zh' ? '活动名称' : 'Event title'} value={value} onChange={setValue} zh={language === 'zh'} translationGroupId="qa-group" />} />
  </main>
}
createRoot(document.getElementById('root')!).render(<AuthProvider><Fixture /></AuthProvider>)
