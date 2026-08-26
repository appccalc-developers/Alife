import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

type AppModalProps = {
  open: boolean
  title: string
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  closeLabel: string
  onClose: () => void
  initialFocusRef?: RefObject<HTMLElement | null>
  closeOnBackdrop?: boolean
  closeOnEscape?: boolean
  closeDisabled?: boolean
  role?: 'dialog' | 'alertdialog'
  size?: 'sm' | 'md'
}

const AppModal = ({
  open,
  title,
  description,
  children,
  footer,
  closeLabel,
  onClose,
  initialFocusRef,
  closeOnBackdrop = true,
  closeOnEscape = true,
  closeDisabled = false,
  role = 'dialog',
  size = 'md',
}: AppModalProps) => {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLElement>(null)
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const animationFrame = window.requestAnimationFrame(() => {
      const target = initialFocusRef?.current
        ?? dialogRef.current?.querySelector<HTMLElement>('[data-modal-autofocus]')
        ?? closeButtonRef.current
        ?? dialogRef.current
      target?.focus()
    })

    return () => {
      window.cancelAnimationFrame(animationFrame)
      document.body.style.overflow = previousOverflow
      if (previouslyFocused?.isConnected) {
        previouslyFocused.focus()
      }
    }
  }, [initialFocusRef, open])

  if (!open || typeof document === 'undefined') return null

  const handleKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape' && closeOnEscape) {
      event.preventDefault()
      onClose()
      return
    }

    if (event.key !== 'Tab') return
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? [])
      .filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true')
    if (focusable.length === 0) {
      event.preventDefault()
      dialogRef.current?.focus()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-end px-3 pb-3 pt-[calc(env(safe-area-inset-top)+4.5rem)] sm:items-center sm:justify-center sm:p-6">
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        className="absolute inset-0 bg-[#102c26]/55 backdrop-blur-[2px]"
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <section
        ref={dialogRef}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`relative z-10 flex max-h-[calc(100dvh-6rem)] w-full flex-col overflow-hidden rounded-3xl border border-[#d6e3dd] bg-[#fffdfa] shadow-[0_28px_80px_rgba(13,79,67,0.28)] ${size === 'sm' ? 'max-w-md' : 'max-w-lg'}`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-[#dce7e2] bg-[#edf5f1] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-black tracking-[-0.02em] text-[#18332d]">
              {title}
            </h2>
            {description ? (
              <div id={descriptionId} className="mt-1.5 text-sm leading-6 text-[#60716a]">
                {description}
              </div>
            ) : null}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            disabled={closeDisabled}
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[#60716a] transition hover:bg-white hover:text-[#18332d] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
            aria-label={closeLabel}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        {children ? <div className="overflow-y-auto px-5 py-5 sm:px-6">{children}</div> : null}
        {footer ? (
          <footer className="flex flex-col-reverse gap-2 border-t border-[#e3ebe7] bg-white/85 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
            {footer}
          </footer>
        ) : null}
      </section>
    </div>,
    document.body,
  )
}

export default AppModal
