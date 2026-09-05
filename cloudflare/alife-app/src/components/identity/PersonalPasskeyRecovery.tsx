import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import AppModal from '../layout/AppModal'
import { useUiText } from '../../i18n/uiText'
import { identityAccessService, type PersonalPasskeyInvitation } from '../../services/identityAccessService'

export default function PersonalPasskeyRecovery({ groupId, memberId, displayName }: {
  groupId: string; memberId: string; displayName: string
}) {
  const t = useUiText()
  const [open, setOpen] = useState(false)
  const [verified, setVerified] = useState(false)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [invitation, setInvitation] = useState<PersonalPasskeyInvitation | null>(null)
  const [image, setImage] = useState('')
  const [expired, setExpired] = useState(false)
  const close = () => { if (!busy) { setOpen(false); setVerified(false); setInvitation(null); setImage(''); setFailed(false) } }
  useEffect(() => {
    if (!invitation) return
    let active = true
    setExpired(false)
    void QRCode.toDataURL(invitation.url, { width: 480, margin: 2 }).then(url => { if (active) setImage(url) }).catch(() => { if (active) setFailed(true) })
    const timer = window.setTimeout(() => setExpired(true), Math.max(0, Date.parse(invitation.expiresUtc) - Date.now()))
    return () => { active = false; window.clearTimeout(timer) }
  }, [invitation])
  const issue = async () => {
    setBusy(true); setFailed(false)
    try { setInvitation(await identityAccessService.issuePersonalPasskey(groupId, memberId)) }
    catch { setFailed(true) } finally { setBusy(false) }
  }
  const revoke = async () => {
    if (!invitation) return
    setBusy(true)
    try { await identityAccessService.revokePersonalPasskey(groupId, memberId, invitation.id); setInvitation(null); setImage(''); setVerified(false) }
    catch { setFailed(true) } finally { setBusy(false) }
  }
  return <>
    <button type="button" className="alife-secondary-button" onClick={() => setOpen(true)}>{t('passkeyRecoveryTitle')}</button>
    <AppModal open={open} title={t('passkeyRecoveryTitle')} onClose={close} closeOnBackdrop={false} closeLabel={t('close')} closeDisabled={busy}>
      <div className="space-y-4">
        <p className="font-bold">{displayName}</p>
        <p className="text-sm leading-6">{t('passkeyRecoveryEffect')}</p>
        {failed ? <p role="alert" className="text-sm text-[#915040]">{t('passkeyRecoveryDenied')}</p> : null}
        {invitation ? <>
          <p>{t('passkeyRecoveryScan')}</p>
          {expired ? <p role="status">{t('passkeyRecoveryExpired')}</p> : image ? <img src={image} width={480} height={480} className="mx-auto aspect-square w-full max-w-80" alt={t('passkeyRecoveryTitle')} /> : <p>{t('identityLoading')}</p>}
          <button className="alife-secondary-button w-full" type="button" disabled={busy} onClick={() => void revoke()}>{t('passkeyRecoveryRevoke')}</button>
        </> : <>
          <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={verified} onChange={event => setVerified(event.target.checked)} />{t('passkeyRecoveryVerified')}</label>
          <button className="alife-primary-button w-full" type="button" disabled={busy || !verified} onClick={() => void issue()}>{busy ? t('identityLoading') : t('passkeyRecoveryGenerate')}</button>
        </>}
      </div>
    </AppModal>
  </>
}
