import { useEffect, useId, useRef, useState } from 'react'
import {
  composePhoneNumber,
  splitPhoneNumber,
  supportedPhoneRegions,
  type SupportedPhoneRegionCode,
} from '../../utils/phoneNumber'

type Props = {
  value: string
  onChange: (value: string) => void
  language: 'en' | 'zh'
  label: string
  hint?: string
  error?: string
  disabled?: boolean
  autoFocus?: boolean
}

const inputClass = 'min-h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-950 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500'

const RegionalPhoneInput = ({ value, onChange, language, label, hint, error, disabled = false, autoFocus = false }: Props) => {
  const id = useId()
  const parsedParts = splitPhoneNumber(value)
  const [selectedRegion, setSelectedRegion] = useState<SupportedPhoneRegionCode>(parsedParts.regionCode)
  const [nationalNumber, setNationalNumber] = useState(parsedParts.nationalNumber)
  const lastEmittedValue = useRef<string | null>(null)
  const visibleError = error || ''

  useEffect(() => {
    if (lastEmittedValue.current === value) {
      lastEmittedValue.current = null
      return
    }

    setSelectedRegion(parsedParts.regionCode)
    setNationalNumber(parsedParts.nationalNumber)
  }, [parsedParts.nationalNumber, parsedParts.regionCode, value])

  const emitValue = (regionCode: SupportedPhoneRegionCode, nextNumber: string) => {
    const nextValue = composePhoneNumber(regionCode, nextNumber)
    lastEmittedValue.current = nextValue
    onChange(nextValue)
  }

  const updateRegion = (nextRegion: SupportedPhoneRegionCode) => {
    setSelectedRegion(nextRegion)
    emitValue(nextRegion, nationalNumber)
  }

  const updateNumber = (nextNumber: string) => {
    setNationalNumber(nextNumber)
    emitValue(selectedRegion, nextNumber)
  }

  return (
    <div>
      <label htmlFor={`${id}-number`} className="text-xs font-black uppercase tracking-wide text-slate-500">{label}</label>
      <div className="mt-1.5 grid grid-cols-[minmax(8.5rem,0.9fr)_minmax(0,1.4fr)] gap-2">
        <select
          id={`${id}-region`}
          aria-label={language === 'zh' ? '国家或地区代码' : 'Country or region code'}
          value={selectedRegion}
          disabled={disabled}
          onChange={(event) => updateRegion(event.target.value as SupportedPhoneRegionCode)}
          className={`${inputClass} min-w-0 px-2`}
        >
          {supportedPhoneRegions.map((region) => (
            <option key={region.code} value={region.code}>
              {region.code} {language === 'zh' ? region.zh : region.en}
            </option>
          ))}
        </select>
        <input
          id={`${id}-number`}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          autoFocus={autoFocus}
          maxLength={16}
          disabled={disabled}
          placeholder={language === 'zh' ? '本地号码' : 'Local number'}
          value={nationalNumber}
          onChange={(event) => updateNumber(event.target.value)}
          aria-invalid={Boolean(visibleError)}
          aria-describedby={visibleError || hint ? `${id}-help` : undefined}
          className={`${inputClass} min-w-0 w-full`}
        />
      </div>
      {visibleError || hint ? (
        <p id={`${id}-help`} className={`mt-1.5 text-xs leading-5 ${visibleError ? 'font-semibold text-rose-600' : 'text-slate-500'}`} role={visibleError ? 'alert' : undefined}>
          {visibleError || hint}
        </p>
      ) : null}
    </div>
  )
}

export default RegionalPhoneInput
