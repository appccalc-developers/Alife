import { manualActivationMessageModalText } from '../../i18n/manualActivationMessageModal.ts'
import { useEffect, useRef, useState } from 'react'
import { Check, Copy, KeyRound, ShieldAlert } from 'lucide-react'
import type { ManualActivationMessage } from '../../services/identityAccessService'
import { writeManualActivationClipboard } from '../../services/manualActivationClipboard'
import AppActionButton from '../layout/AppActionButton'
import AppModal from '../layout/AppModal'

type Props = {
  value: ManualActivationMessage | null
  language: string
  onClose: () => void
}

type CopyState = 'idle' | 'phone' | 'message' | 'error'

const ManualActivationMessageModal = ({ value, language, onClose }: Props) => {
  const zh = language === 'zh'
  const messageButtonRef = useRef<HTMLButtonElement>(null)
  const phoneRef = useRef<HTMLInputElement>(null)
  const messageRef = useRef<HTMLTextAreaElement>(null)
  const [copyState, setCopyState] = useState<CopyState>('idle')
  const useEmail = Boolean(value?.recipientEmail && (value.replyPreference === 'email' || !value.recipientPhoneE164))
  const recipient = useEmail ? value?.recipientEmail ?? '' : value?.recipientPhoneE164 ?? ''

  useEffect(() => {
    if (value) setCopyState('idle')
  }, [value])

  const copyValue = async (kind: 'phone' | 'message', text: string) => {
    if (await writeManualActivationClipboard(text)) {
      setCopyState(kind)
      return
    }
    setCopyState('error')
    const target = kind === 'phone' ? phoneRef.current : messageRef.current
    target?.focus()
    target?.select()
  }

  return (
    <AppModal
      open={value !== null}
      title={zh ? manualActivationMessageModalText.copyActivationMessage.zh : manualActivationMessageModalText.copyActivationMessage.en}
      description={zh
        ? manualActivationMessageModalText.sendThisMessageOnlyToTheMemberWhoseIdentity.zh
        : manualActivationMessageModalText.sendThisMessageOnlyToTheMemberWhoseIdentity.en}
      closeLabel={zh ? manualActivationMessageModalText.closeActivationMessageDialog.zh : manualActivationMessageModalText.closeActivationMessageDialog.en}
      onClose={onClose}
      closeOnBackdrop={false}
      initialFocusRef={messageButtonRef}
      footer={(
        <AppActionButton variant="secondary" onClick={onClose}>
          {zh ? manualActivationMessageModalText.close.zh : manualActivationMessageModalText.close.en}
        </AppActionButton>
      )}
    >
      {value ? <div className="space-y-4">
        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="text-xs font-semibold leading-5">
            {zh
              ? manualActivationMessageModalText.thisMessageIsShownOnceAfterClosingItYou.zh
              : manualActivationMessageModalText.thisMessageIsShownOnceAfterClosingItYou.en}
          </p>
        </div>

        <label className="block text-sm font-bold text-[#40554e]">
          {useEmail ? (zh ? manualActivationMessageModalText.recipientEmail.zh : manualActivationMessageModalText.recipientEmail.en) : (zh ? manualActivationMessageModalText.recipientPhone.zh : manualActivationMessageModalText.recipientPhone.en)}
          <input
            ref={phoneRef}
            className="mt-1.5 min-h-11 w-full rounded-xl border border-[#cbdad4] bg-[#f7faf8] px-3 font-mono text-sm text-[#18332d] outline-none focus:border-[#21705f] focus:ring-4 focus:ring-[#dcece6]"
            readOnly
            value={recipient}
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
        <AppActionButton block onClick={() => void copyValue('phone', recipient)}>
          {copyState === 'phone' ? <Check className="mr-2 h-4 w-4" aria-hidden="true" /> : <Copy className="mr-2 h-4 w-4" aria-hidden="true" />}
          {copyState === 'phone' ? (zh ? manualActivationMessageModalText.recipientCopied.zh : manualActivationMessageModalText.recipientCopied.en) : (zh ? manualActivationMessageModalText.copyRecipient.zh : manualActivationMessageModalText.copyRecipient.en)}
        </AppActionButton>

        <label className="block text-sm font-bold text-[#40554e]">
          {zh ? manualActivationMessageModalText.activationMessage.zh : manualActivationMessageModalText.activationMessage.en}
          <textarea
            ref={messageRef}
            className="mt-1.5 min-h-40 w-full resize-y rounded-xl border border-[#cbdad4] bg-[#f7faf8] px-3 py-3 text-sm leading-6 text-[#18332d] outline-none focus:border-[#21705f] focus:ring-4 focus:ring-[#dcece6]"
            readOnly
            spellCheck={false}
            value={value.message}
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
        <AppActionButton ref={messageButtonRef} block variant="primary" onClick={() => void copyValue('message', value.message)}>
          {copyState === 'message' ? <Check className="mr-2 h-4 w-4" aria-hidden="true" /> : <KeyRound className="mr-2 h-4 w-4" aria-hidden="true" />}
          {copyState === 'message' ? (zh ? manualActivationMessageModalText.messageCopied.zh : manualActivationMessageModalText.messageCopied.en) : (zh ? manualActivationMessageModalText.copyActivationMessageLabel.zh : manualActivationMessageModalText.copyActivationMessageLabel.en)}
        </AppActionButton>

        {copyState === 'error' ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm leading-6 text-rose-700" role="alert">
          {zh ? manualActivationMessageModalText.theBrowserCouldNotWriteToTheClipboardThe.zh : manualActivationMessageModalText.theBrowserCouldNotWriteToTheClipboardThe.en}
        </p> : null}
      </div> : null}
    </AppModal>
  )
}

export default ManualActivationMessageModal
