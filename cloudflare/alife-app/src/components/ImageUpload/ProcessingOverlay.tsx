import React from 'react'

type ProcessingOverlayProps = {
  progress: number
  message?: string
}

const ProcessingOverlay: React.FC<ProcessingOverlayProps> = ({ progress, message }) => {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-slate-200 bg-white/95 p-8 shadow-sm">
      {/* Spinner */}
      <div className="relative h-12 w-12">
        <svg className="h-12 w-12 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="text-slate-200" />
          <path
            d="M12 2a10 10 0 0 1 10 10"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            className="text-emerald-600"
          />
        </svg>
      </div>

      {/* Message */}
      <p className="text-sm font-medium text-slate-700">{message || 'Processing image…'}</p>

      {/* Progress bar */}
      {progress > 0 && (
        <div className="w-full max-w-xs">
          <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
            <span>Compressing</span>
            <span>{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all duration-300 ease-out"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  )
}

export default ProcessingOverlay
