import { useCallback, useEffect, useRef, useState } from 'react'
import AppConfirmationModal, { type ConfirmationTone } from '../components/layout/AppConfirmationModal'
import { useUiText } from '../i18n/uiText'

export type ConfirmationOptions = {
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: ConfirmationTone
}

const useConfirmation = () => {
  const t = useUiText()
  const [request, setRequest] = useState<ConfirmationOptions | null>(null)
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null)

  const requestConfirmation = useCallback((options: ConfirmationOptions) => new Promise<boolean>((resolve) => {
    resolverRef.current?.(false)
    resolverRef.current = resolve
    setRequest(options)
  }), [])

  const settle = useCallback((confirmed: boolean) => {
    const resolve = resolverRef.current
    resolverRef.current = null
    setRequest(null)
    resolve?.(confirmed)
  }, [])

  useEffect(() => () => {
    resolverRef.current?.(false)
    resolverRef.current = null
  }, [])

  return {
    requestConfirmation,
    confirmationModal: (
      <AppConfirmationModal
        open={Boolean(request)}
        title={request?.title ?? ''}
        description={request?.description ?? ''}
        confirmLabel={request?.confirmLabel ?? t('confirm')}
        cancelLabel={request?.cancelLabel ?? t('cancel')}
        closeLabel={t('closeConfirmationDialog')}
        tone={request?.tone}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    ),
  }
}

export default useConfirmation
