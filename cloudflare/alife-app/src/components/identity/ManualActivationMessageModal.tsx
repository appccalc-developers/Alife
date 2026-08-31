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
      title={zh ? '复制激活短消息' : 'Copy activation message'}
      description={zh
        ? '请把这条消息发送给刚刚核对过身份的成员。'
        : 'Send this message only to the member whose identity you just verified.'}
      closeLabel={zh ? '关闭激活消息窗口' : 'Close activation message dialog'}
      onClose={onClose}
      closeOnBackdrop={false}
      initialFocusRef={messageButtonRef}
      footer={(
        <AppActionButton variant="secondary" onClick={onClose}>
          {zh ? '关闭' : 'Close'}
        </AppActionButton>
      )}
    >
      {value ? <div className="space-y-4">
        <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-950">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <p className="text-xs font-semibold leading-5">
            {zh
              ? '此消息只显示一次。关闭后只能生成新链接，旧链接会被撤销。链接代表该成员身份、会过期，请勿发送给其他人。'
              : 'This message is shown once. After closing it, you must generate a new link and the old one will be revoked. The link represents this member’s identity, expires, and must not be sent to anyone else.'}
          </p>
        </div>

        <label className="block text-sm font-bold text-[#40554e]">
          {zh ? '收件人手机号' : 'Recipient phone'}
          <input
            ref={phoneRef}
            className="mt-1.5 min-h-11 w-full rounded-xl border border-[#cbdad4] bg-[#f7faf8] px-3 font-mono text-sm text-[#18332d] outline-none focus:border-[#21705f] focus:ring-4 focus:ring-[#dcece6]"
            readOnly
            value={value.recipientPhoneE164}
            onFocus={(event) => event.currentTarget.select()}
          />
        </label>
        <AppActionButton block onClick={() => void copyValue('phone', value.recipientPhoneE164)}>
          {copyState === 'phone' ? <Check className="mr-2 h-4 w-4" aria-hidden="true" /> : <Copy className="mr-2 h-4 w-4" aria-hidden="true" />}
          {copyState === 'phone' ? (zh ? '手机号已复制' : 'Phone copied') : (zh ? '复制手机号' : 'Copy phone')}
        </AppActionButton>

        <label className="block text-sm font-bold text-[#40554e]">
          {zh ? '激活短消息' : 'Activation message'}
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
          {copyState === 'message' ? (zh ? '消息已复制' : 'Message copied') : (zh ? '复制激活消息' : 'Copy activation message')}
        </AppActionButton>

        {copyState === 'error' ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm leading-6 text-rose-700" role="alert">
          {zh ? '浏览器无法写入剪贴板。内容已选中，请使用系统复制命令。' : 'The browser could not write to the clipboard. The content is selected; use your system copy command.'}
        </p> : null}
      </div> : null}
    </AppModal>
  )
}

export default ManualActivationMessageModal
