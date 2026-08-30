import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Check, KeyRound, LogOut, Mail, Pencil, Phone, Plus, ShieldCheck, Trash2, UserRound, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import RegionalPhoneInput from '../components/forms/RegionalPhoneInput'
import AppActionButton from '../components/layout/AppActionButton'
import AppBadge from '../components/layout/AppBadge'
import AppEmptyState from '../components/layout/AppEmptyState'
import AppPageShell from '../components/layout/AppPageShell'
import AppSectionCard from '../components/layout/AppSectionCard'
import { useUiText } from '../i18n/uiText'
import { authService } from '../services/authService'
import { groupService } from '../services/groupService'
import { identityAccessService, type PasskeyCredential } from '../services/identityAccessService'
import { normalizeApiError } from '../services/http'
import { useAuthStore } from '../stores/auth'
import { isValidPhoneNumber } from '../utils/phoneNumber'
import { localizeText } from '../utils/localizedText'

const ProfileView = () => {
  const auth = useAuthStore()
  const t = useUiText()
  const navigate = useNavigate()
  const me = auth.me
  const language = auth.language
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [form, setForm] = useState({ displayName: '', email: '', phoneE164: '' })
  const [loggingOut, setLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const [inviteActionGroupId, setInviteActionGroupId] = useState('')
  const [inviteError, setInviteError] = useState('')
  const [passkeys, setPasskeys] = useState<PasskeyCredential[]>([])
  const [passkeyName, setPasskeyName] = useState('')
  const [passkeyBusy, setPasskeyBusy] = useState(false)
  const [passkeyError, setPasskeyError] = useState('')
  const [passkeyStatus, setPasskeyStatus] = useState('')
  const [confirmRevokeId, setConfirmRevokeId] = useState('')

  const copy = language === 'zh'
    ? {
      eyebrow: '会员账号', intro: '在这里管理你的联系方式、账号资料和小组邀请。',
      edit: '编辑资料', cancel: '取消', save: '保存资料', saving: '保存中…', saved: '个人资料已更新。',
      contactTitle: '联系资料', contactSubtitle: '你可以自行修改以下信息。',
      nameRequired: '请填写显示名称。', invalidPhone: '请检查电话号码和所选地区。',
      phoneHint: '选择地区后输入本地号码，可保留开头的 0。',
      phoneSecurity: '修改电话号码后，原有的电话验证状态会被清除。',
      accountStatus: '账号状态', signOutSubtitle: '退出后，需要重新登录才能使用会员功能。',
      passkeysTitle: 'Passkey 与登录安全', passkeysSubtitle: '查看、命名、添加或撤销可用于进入 ALIFE 的 Passkey。',
      passkeyPrivacy: 'ALIFE 只保存公钥和凭据元数据，不会接收或保存设备 PIN、指纹或面容资料。',
      passkeyName: 'Passkey 名称', passkeyNamePlaceholder: '例如：我的手机', addPasskey: '添加 Passkey',
      noPasskeys: '尚未添加 Passkey。', lastUsed: '最近使用', created: '建立日期', revoke: '撤销',
      confirmRevoke: '再次点击以确认撤销', passkeyAdded: 'Passkey 已添加。', passkeyRevoked: 'Passkey 已撤销。',
      strongAuthHint: '添加或撤销需要最近五分钟内完成 Passkey 或 LINE 强认证。', addPasskeyRecommended: '建议现在添加 Passkey，作为主要登录方式。',
    }
    : {
      eyebrow: 'Member account', intro: 'Manage your contact details, account profile, and group invitations in one place.',
      edit: 'Edit profile', cancel: 'Cancel', save: 'Save profile', saving: 'Saving…', saved: 'Your profile has been updated.',
      contactTitle: 'Contact details', contactSubtitle: 'You can update the information below yourself.',
      nameRequired: 'Display name is required.', invalidPhone: 'Check the phone number and selected region.',
      phoneHint: 'Choose a region and enter the local number. You may keep its leading zero.',
      phoneSecurity: 'Changing your phone number clears its existing verification status.',
      accountStatus: 'Account status', signOutSubtitle: 'You will need to sign in again to use member features.',
      passkeysTitle: 'Passkeys and sign-in security', passkeysSubtitle: 'View, name, add, or revoke passkeys that can open ALIFE.',
      passkeyPrivacy: 'ALIFE stores only public keys and credential metadata. It never receives or stores your device PIN, fingerprint, or face data.',
      passkeyName: 'Passkey name', passkeyNamePlaceholder: 'For example: My phone', addPasskey: 'Add passkey',
      noPasskeys: 'No passkeys have been added.', lastUsed: 'Last used', created: 'Created', revoke: 'Revoke',
      confirmRevoke: 'Click again to confirm revocation', passkeyAdded: 'Passkey added.', passkeyRevoked: 'Passkey revoked.',
      strongAuthHint: 'Adding or revoking requires a passkey or LINE strong authentication from the last five minutes.', addPasskeyRecommended: 'Add a passkey now to make it your primary sign-in method.',
    }

  useEffect(() => {
    if (!me || me.isGuest) return
    let active = true
    identityAccessService.listPasskeys()
      .then((items) => { if (active) setPasskeys(items) })
      .catch((error) => { if (active) setPasskeyError(normalizeApiError(error).message) })
    return () => { active = false }
  }, [me])

  const invitations = me?.memberships.filter((membership) => membership.status === 'invited') ?? []
  const initials = useMemo(() => {
    const name = me?.displayName?.trim()
    if (!name) return 'A'
    return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  }, [me?.displayName])

  const beginEditing = () => {
    if (!me) return
    setForm({ displayName: me.displayName || '', email: me.email || '', phoneE164: me.phoneE164 || '' })
    setSaveError('')
    setSaveSuccess(false)
    setEditing(true)
  }

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const displayName = form.displayName.trim()
    if (!displayName) {
      setSaveError(copy.nameRequired)
      return
    }
    if (!isValidPhoneNumber(form.phoneE164)) {
      setSaveError(copy.invalidPhone)
      return
    }

    setSaving(true)
    setSaveError('')
    try {
      await authService.updateProfile({
        displayName,
        email: form.email.trim() || null,
        phoneE164: form.phoneE164 || null,
      })
      await auth.fetchMe()
      setEditing(false)
      setSaveSuccess(true)
    } catch (error) {
      setSaveError(normalizeApiError(error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = async () => {
    setLoggingOut(true)
    setLogoutError('')
    try {
      await auth.logout()
      navigate('/onboarding', { replace: true })
    } catch (error) {
      setLogoutError(normalizeApiError(error).message)
    } finally {
      setLoggingOut(false)
    }
  }

  const respondToInvite = async (groupId: string, accept: boolean) => {
    setInviteActionGroupId(groupId)
    setInviteError('')
    try {
      if (accept) await groupService.acceptInvite(groupId, auth.me?.id)
      else await groupService.declineInvite(groupId, auth.me?.id)
      await auth.fetchMe()
    } catch (error) {
      setInviteError(normalizeApiError(error).message)
    } finally {
      setInviteActionGroupId('')
    }
  }

  const addPasskey = async () => {
    setPasskeyBusy(true)
    setPasskeyError('')
    setPasskeyStatus('')
    try {
      await identityAccessService.registerPasskey(passkeyName.trim() || undefined)
      setPasskeys(await identityAccessService.listPasskeys())
      setPasskeyName('')
      setPasskeyStatus(copy.passkeyAdded)
      await auth.fetchMe()
    } catch (error) {
      setPasskeyError(normalizeApiError(error).message)
    } finally {
      setPasskeyBusy(false)
    }
  }

  const revokePasskey = async (credentialId: string) => {
    if (confirmRevokeId !== credentialId) {
      setConfirmRevokeId(credentialId)
      return
    }
    setPasskeyBusy(true)
    setPasskeyError('')
    setPasskeyStatus('')
    try {
      await identityAccessService.revokePasskey(credentialId)
      setPasskeys(await identityAccessService.listPasskeys())
      setConfirmRevokeId('')
      setPasskeyStatus(copy.passkeyRevoked)
    } catch (error) {
      setPasskeyError(normalizeApiError(error).message)
    } finally {
      setPasskeyBusy(false)
    }
  }

  if (!me) return <AppEmptyState title={t('profile')} description={t('loadingIdentity')} />

  return (
    <AppPageShell>
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#123f35] via-[#176b5a] to-[#24917a] px-5 py-6 text-white shadow-[0_20px_55px_rgba(18,63,53,0.24)] sm:px-8 sm:py-8">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full border border-white/15 bg-white/5" aria-hidden="true" />
        <div className="relative">
          <div className="absolute right-0 top-0 flex items-center gap-2 rounded-xl border border-white/20 bg-[#0d4f43]/35 px-3 py-2 shadow-sm backdrop-blur">
            <span className="text-[0.65rem] font-black uppercase tracking-[0.12em] text-emerald-50/80">{copy.accountStatus}</span>
            <AppBadge variant={me.isRegistered ? 'success' : 'neutral'}>{me.isRegistered ? t('registered') : t('guest')}</AppBadge>
          </div>
          <div className="flex min-w-0 items-center gap-4 pt-14 sm:gap-5 sm:pr-52 sm:pt-0">
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl border border-white/25 bg-white/15 text-xl font-black shadow-inner backdrop-blur sm:h-20 sm:w-20 sm:text-2xl">{initials}</div>
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-100">{copy.eyebrow}</p>
              <h1 className="mt-1 truncate text-2xl font-black tracking-[-0.03em] sm:text-3xl">{me.displayName || t('profile')}</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/85">{copy.intro}</p>
            </div>
          </div>
        </div>
      </section>

      {saveSuccess ? <p className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800" role="status"><Check className="h-4 w-4" />{copy.saved}</p> : null}

      <AppSectionCard
        title={copy.contactTitle}
        subtitle={copy.contactSubtitle}
        action={!editing && !me.isGuest ? (
          <AppActionButton onClick={beginEditing}>
            <Pencil className="mr-2 h-4 w-4" aria-hidden="true" />{copy.edit}
          </AppActionButton>
        ) : null}
      >
        {editing ? (
          <form className="space-y-4" onSubmit={saveProfile}>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">{t('displayName')}</span>
              <input autoFocus required maxLength={150} value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            </label>
            <label className="block">
              <span className="text-xs font-black uppercase tracking-wide text-slate-500">{t('email')}</span>
              <input type="email" maxLength={200} value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            </label>
            <RegionalPhoneInput value={form.phoneE164} onChange={(phoneE164) => setForm((current) => ({ ...current, phoneE164 }))} language={language} label={t('phone')} hint={copy.phoneHint} />
            <p className="flex gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{copy.phoneSecurity}</p>
            {saveError ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{saveError}</p> : null}
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
              <AppActionButton disabled={saving} onClick={() => { setEditing(false); setSaveError('') }}><X className="mr-1.5 h-4 w-4" />{copy.cancel}</AppActionButton>
              <AppActionButton type="submit" variant="primary" disabled={saving}><Check className="mr-1.5 h-4 w-4" />{saving ? copy.saving : copy.save}</AppActionButton>
            </div>
          </form>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { icon: UserRound, label: t('displayName'), value: me.displayName },
              { icon: Mail, label: t('email'), value: me.email },
              { icon: Phone, label: t('phone'), value: me.phoneE164 },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex min-h-24 gap-3 rounded-2xl border border-[#2f4b42]/10 bg-[#f7faf8] p-4 sm:last:col-span-2">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                <div className="min-w-0"><p className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 break-words text-sm font-semibold text-slate-900">{value || '-'}</p></div>
              </div>
            ))}
          </div>
        )}
      </AppSectionCard>

      {!me.isGuest ? (
        <AppSectionCard title={copy.passkeysTitle} subtitle={copy.passkeysSubtitle}>
          <div className="space-y-4">
            <p className="flex gap-2 rounded-xl bg-emerald-50 px-3 py-2.5 text-xs leading-5 text-emerald-900"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{copy.passkeyPrivacy}</p>
            {me.needsPasskey ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm font-semibold text-amber-900">{copy.addPasskeyRecommended}</p> : null}
            {passkeys.length ? (
              <ul className="space-y-2">
                {passkeys.map((credential) => (
                  <li key={credential.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-100 text-emerald-800"><KeyRound className="h-5 w-5" aria-hidden="true" /></span>
                      <div className="min-w-0"><p className="truncate font-semibold text-slate-950">{credential.displayName}</p><p className="mt-1 text-xs text-slate-500">{copy.created}: {new Date(credential.createdUtc).toLocaleDateString()} · {copy.lastUsed}: {credential.lastUsedUtc ? new Date(credential.lastUsedUtc).toLocaleDateString() : '—'}</p></div>
                    </div>
                    <AppActionButton size="sm" variant={confirmRevokeId === credential.id ? 'danger' : undefined} disabled={passkeyBusy} onClick={() => void revokePasskey(credential.id)}><Trash2 className="mr-1.5 h-4 w-4" />{confirmRevokeId === credential.id ? copy.confirmRevoke : copy.revoke}</AppActionButton>
                  </li>
                ))}
              </ul>
            ) : <AppEmptyState title={copy.noPasskeys} description={copy.strongAuthHint} />}
            <div className="grid gap-3 border-t border-slate-100 pt-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <label className="block"><span className="text-xs font-black uppercase tracking-wide text-slate-500">{copy.passkeyName}</span><input className="mt-1.5 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" maxLength={120} placeholder={copy.passkeyNamePlaceholder} value={passkeyName} onChange={(event) => setPasskeyName(event.target.value)} /></label>
              <AppActionButton variant="primary" disabled={passkeyBusy} onClick={() => void addPasskey()}><Plus className="mr-1.5 h-4 w-4" />{copy.addPasskey}</AppActionButton>
            </div>
            <p className="text-xs leading-5 text-slate-500">{copy.strongAuthHint}</p>
            {passkeyStatus ? <p className="text-sm font-semibold text-emerald-700" role="status">{passkeyStatus}</p> : null}
            {passkeyError ? <p className="text-sm text-rose-700" role="alert">{passkeyError}</p> : null}
          </div>
        </AppSectionCard>
      ) : null}

      {invitations.length > 0 ? (
        <AppSectionCard dense title={t('groupInvitations')} subtitle={t('groupInvitationsSubtitle')}>
          <div className="space-y-2">
            {invitations.map((membership) => {
              const groupName = localizeText(membership.groupName, language) || t('group')
              const isBusy = inviteActionGroupId === membership.groupId
              return <div key={membership.groupId} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"><div><p className="font-semibold text-slate-950">{groupName}</p><p className="mt-1 text-xs text-slate-500">{t('invited')}</p></div><div className="flex gap-2"><AppActionButton size="sm" variant="primary" disabled={isBusy} onClick={() => void respondToInvite(membership.groupId, true)}>{isBusy ? t('saving') : t('acceptInvite')}</AppActionButton><AppActionButton size="sm" variant="danger" disabled={isBusy} onClick={() => void respondToInvite(membership.groupId, false)}>{t('declineInvite')}</AppActionButton></div></div>
            })}
            {inviteError ? <p className="text-sm text-rose-600">{inviteError}</p> : null}
          </div>
        </AppSectionCard>
      ) : null}

      <div className="pt-4 sm:pt-6">
        <AppSectionCard dense title={t('logout')} subtitle={copy.signOutSubtitle}>
          <AppActionButton variant="danger" disabled={loggingOut} onClick={() => void handleLogout()}><LogOut className="mr-2 h-4 w-4" />{loggingOut ? t('loggingOut') : t('logout')}</AppActionButton>
          {logoutError ? <p className="mt-3 text-sm text-rose-600">{logoutError}</p> : null}
        </AppSectionCard>
      </div>
    </AppPageShell>
  )
}

export default ProfileView
