import { useEffect, useRef } from 'react'
import AiLanguageAutofill from '../ai/AiLanguageAutofill'
import { useAuthStore } from '../../stores/auth'
import { applyEventTranslation, eventTranslationFields } from '../../utils/eventTranslation'

export default function EventTextTranslation({ groupId, value, onChange, disabled, textType, maxLength }: {
  groupId: string; value: { en: string; zh: string }; onChange: (value: { en: string; zh: string }) => void
  disabled?: boolean; textType: string; maxLength?: number
}) {
  const actor = useAuthStore().me?.id
  const current = useRef({ value, onChange, disabled, actor, groupId })
  current.current = { value, onChange, disabled, actor, groupId }
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  const fields = eventTranslationFields(value, textType)
  return <AiLanguageAutofill className="mt-2" groupId={groupId} fields={fields} disabled={disabled || !actor || !groupId} onTranslated={translated => {
    const latest = current.current
    if (!mounted.current || latest.disabled || latest.actor !== actor || latest.groupId !== groupId) return false
    const next = applyEventTranslation(latest.value, fields, translated, maxLength)
    if (!next) return false
    latest.onChange(next)
  }} />
}
