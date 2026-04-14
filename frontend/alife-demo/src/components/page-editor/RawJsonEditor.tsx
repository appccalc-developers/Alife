import type { TextareaHTMLAttributes } from 'react'

type Props = {
  label: string
  value: string
  parseError?: string
  rows?: number
  onChange: (value: string) => void
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'>

const RawJsonEditor = ({ label, value, parseError, rows = 8, onChange, ...props }: Props) => (
  <label className="block space-y-1">
    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
    <textarea
      value={value}
      rows={rows}
      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-xs shadow-inner disabled:bg-slate-100"
      onChange={(event) => onChange(event.target.value)}
      {...props}
    />
    {parseError ? <p className="text-xs text-red-600">{parseError}</p> : null}
  </label>
)

export default RawJsonEditor
