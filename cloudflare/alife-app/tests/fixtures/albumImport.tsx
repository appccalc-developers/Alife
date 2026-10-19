// Fictional UI fixture; APIs and Google SDK are intercepted by the browser test.
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import AlbumPhotoImport from '../../src/components/media/AlbumPhotoImport'
import '../../src/styles/global.css'

function Fixture() {
  const [language, setLanguage] = useState('en')
  const [open, setOpen] = useState(false)
  const [files, setFiles] = useState<File[]>()
  const [saved, setSaved] = useState(0)
  const mode = new URLSearchParams(location.search).get('mode')
  return <main>
    <p>Simulated album import / 模拟照片导入</p>
    <button onClick={() => setLanguage(current => current === 'en' ? 'zh' : 'en')}>Switch language</button>
    <input aria-label="Fixture photos" type="file" multiple onChange={event => { setFiles(Array.from(event.target.files ?? [])); setOpen(true) }} />
    <button onClick={() => { setFiles(undefined); setOpen(true) }}>Open Drive fixture</button>
    <output aria-label="Saved">{saved}</output>
    {open ? <AlbumPhotoImport language={language} files={files} album={{ id: '22222222-2222-2222-2222-222222222222', groupId: '11111111-1111-1111-1111-111111111111', name: { en: 'Fictional fellowship photos', zh: '模拟团契照片相册' }, visibility: mode === 'public' ? 'public' : 'groupVisible', sortOrder: 0, photoCount: 0, childCount: 0 }} onClose={() => setOpen(false)} onComplete={async () => { setSaved(current => current + 1) }} /> : null}
  </main>
}
createRoot(document.getElementById('root')!).render(<StrictMode><Fixture /></StrictMode>)
