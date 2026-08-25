import { useMutation } from '@tanstack/react-query'
import { Bot, Check, ChevronDown, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { eventModuleSuggestionService } from '../../services/eventModuleSuggestionService'
import { normalizeApiError } from '../../services/http'
import type { EventModuleSuggestionItem, EventModuleSuggestionKey, EventModuleSuggestionResponse } from '../../types/eventModuleSuggestion'
import { localizeText } from '../../utils/localizedText'

type Props = {
  eventId: string
  module: EventModuleSuggestionKey
  language: string
  onApply: (suggestion: EventModuleSuggestionItem) => void
  formatValue?: (suggestion: EventModuleSuggestionItem) => string
  guidancePlaceholder?: { en: string; zh: string }
}

const EventModuleSuggestionsPanel = ({ eventId, module, language, onApply, formatValue, guidancePlaceholder }: Props) => {
  const chinese = language === 'zh'
  const [guidance, setGuidance] = useState('')
  const [result, setResult] = useState<EventModuleSuggestionResponse | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [applied, setApplied] = useState(false)
  const mutation = useMutation({
    mutationFn: () => eventModuleSuggestionService.generate(eventId, module, guidance),
    onSuccess: (response) => {
      setResult(response)
      setSelected(new Set())
      setApplied(false)
    },
  })

  const toggle = (key: string) => setSelected((current) => {
    const next = new Set(current)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })

  const applySelected = () => {
    result?.suggestions.filter((item) => selected.has(item.key)).forEach(onApply)
    setApplied(true)
    setSelected(new Set())
  }

  const basisLabel = (basis: EventModuleSuggestionItem['basis']) => ({
    currentEvent: chinese ? '根据本次活动' : 'Current event',
    confirmedHistory: chinese ? '参考已确认经验' : 'Confirmed history',
    inference: chinese ? '建议，请核对' : 'Recommendation — verify',
  })[basis]

  return <section className="border-t border-[#2f4b42]/10 pt-5" aria-labelledby={`ai-${module}-suggestions-title`}>
    <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700"><Sparkles className="h-4 w-4" /></span><div><h3 id={`ai-${module}-suggestions-title`} className="text-sm font-black text-[#18332d]">{chinese ? 'AI 设置建议' : 'AI setting suggestions'}</h3><p className="mt-1 text-xs leading-5 text-[#687a73]">{chinese ? '只生成预览，不会修改或保存。逐项选择后，建议才会放入左侧表单。' : 'Generates a preview only. Select individual items before placing them in the form.'}</p></div></div>

    <details className="group mt-4"><summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-xs font-black text-violet-700"><span>{chinese ? '补充你的要求（可选）' : 'Add guidance (optional)'}</span><ChevronDown className="h-4 w-4 transition group-open:rotate-180" /></summary><textarea rows={2} maxLength={1000} value={guidance} onChange={(event) => setGuidance(event.target.value)} placeholder={guidancePlaceholder ? localizeText(guidancePlaceholder, language) : (chinese ? '例如：预计以家庭为单位报名，需要为餐饮预留一周。' : 'For example: register by family and leave one week for catering.')} className="mt-3 w-full rounded-xl border border-violet-200 bg-white px-3 py-2 text-sm outline-none focus:border-violet-500" /></details>
    <button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-3.5 py-2.5 text-xs font-black text-violet-700 shadow-sm disabled:opacity-45"><Bot className="h-4 w-4" />{mutation.isPending ? (chinese ? '正在整理建议…' : 'Preparing suggestions…') : result ? (chinese ? '重新生成建议' : 'Generate again') : (chinese ? '生成设置建议' : 'Generate suggestions')}</button>

    {mutation.error ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-700">{normalizeApiError(mutation.error).message}</p> : null}
    {result ? <div className="mt-4">
      {result.suggestions.length ? <div className="divide-y divide-[#2f4b42]/10 border-y border-[#2f4b42]/10">{result.suggestions.map((item) => {
        const checked = selected.has(item.key)
        return <label key={item.key} className="flex cursor-pointer items-start gap-3 py-4"><input type="checkbox" checked={checked} onChange={() => toggle(item.key)} className="mt-1 h-4 w-4 accent-violet-700" /><span className="min-w-0"><span className="flex flex-wrap items-center gap-2"><span className="text-sm font-black text-[#18332d]">{localizeText(item.label, language)}</span><span className="rounded-full bg-violet-50 px-2 py-0.5 text-[10px] font-black text-violet-700">{basisLabel(item.basis)}</span></span><span className="mt-1 block break-words text-sm font-bold text-[#40534c]">{formatValue ? formatValue(item) : item.value}</span><span className="mt-1 block text-xs leading-5 text-[#687a73]">{localizeText(item.rationale, language)}</span></span></label>
      })}</div> : <p className="rounded-xl bg-[#f3f6f3] px-3 py-3 text-xs leading-5 text-[#687a73]">{chinese ? '没有足够可靠的资料生成设置建议。请先补充活动事实。' : 'There is not enough reliable information for a setting suggestion. Add more event facts first.'}</p>}
      {result.warnings.length ? <ul className="mt-3 space-y-1 text-xs leading-5 text-amber-800">{result.warnings.map((warning, index) => <li key={`${warning.en}-${index}`}>• {localizeText(warning, language)}</li>)}</ul> : null}
      {result.suggestions.length ? <button type="button" disabled={!selected.size} onClick={applySelected} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-700 px-4 py-2.5 text-xs font-black text-white disabled:opacity-40"><Check className="h-4 w-4" />{chinese ? `将已选 ${selected.size} 项放入表单` : `Place ${selected.size} selected in form`}</button> : null}
      {applied ? <p className="mt-3 text-xs font-bold leading-5 text-emerald-800">{chinese ? '已放入表单，但尚未保存。请核对后使用页面的保存按钮。' : 'Placed in the form but not saved. Review it, then use the page save button.'}</p> : null}
    </div> : null}
  </section>
}

export default EventModuleSuggestionsPanel
