import { useRef, type ReactNode } from 'react'
import { AlertTriangle, CircleHelp } from 'lucide-react'
import AppActionButton from './AppActionButton'
import AppModal from './AppModal'

export type ConfirmationTone = 'primary' | 'danger'

export type AppConfirmationModalProps = {
  open: boolean
  title: string
  description: ReactNode
  confirmLabel: string
  cancelLabel: string
  closeLabel: string
  tone?: ConfirmationTone
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

const AppConfirmationModal = ({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  closeLabel,
  tone = 'primary',
  busy = false,
  onConfirm,
  onCancel,
}: AppConfirmationModalProps) => {
  const cancelButtonRef = useRef<HTMLButtonElement>(null)
  const destructive = tone === 'danger'

  return (
    <AppModal
      open={open}
      role="alertdialog"
      size="sm"
      title={title}
      description={(
        <div className={`flex gap-3 rounded-2xl border px-4 py-3 ${destructive ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-[#c7ddd5] bg-white/80 text-[#31544b]'}`}>
          {destructive
            ? <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            : <CircleHelp className="mt-0.5 h-5 w-5 shrink-0 text-[#176b5a]" aria-hidden="true" />}
          <p className="text-sm font-semibold leading-6">{description}</p>
        </div>
      )}
      closeLabel={closeLabel}
      onClose={onCancel}
      closeOnBackdrop={!busy}
      closeOnEscape={!busy}
      closeDisabled={busy}
      initialFocusRef={cancelButtonRef}
      footer={(
        <>
          <AppActionButton ref={cancelButtonRef} variant="secondary" disabled={busy} onClick={onCancel}>
            {cancelLabel}
          </AppActionButton>
          <AppActionButton
            variant={destructive ? 'danger' : 'primary'}
            disabled={busy}
            onClick={onConfirm}
          >
            {confirmLabel}
          </AppActionButton>
        </>
      )}
    />
  )
}

export default AppConfirmationModal
