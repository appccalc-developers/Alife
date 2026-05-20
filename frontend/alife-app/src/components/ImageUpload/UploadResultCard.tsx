import React from 'react'
import type { CompressionResult } from '../../hooks/useImageUpload'

type UploadResultCardProps = {
  result: CompressionResult
  uploadedUrl?: string
  onReset: () => void
}

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const savingsPercent = (original: number, compressed: number) => {
  if (!original) return 0
  return Math.round((1 - compressed / original) * 100)
}

const UploadResultCard: React.FC<UploadResultCardProps> = ({ result, uploadedUrl, onReset }) => {
  const savings = savingsPercent(result.originalSize, result.compressedSize)
  const formatLabel = result.format.includes('webp') ? 'WebP' : result.format.includes('jpeg') ? 'JPEG' : result.format.split('/')[1] || result.format

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* Stats */}
      <div className="divide-y divide-slate-100">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-slate-500">Original</span>
          <span className="text-sm font-medium text-slate-700">{formatBytes(result.originalSize)}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-slate-500">Compressed</span>
          <span className="text-sm font-medium text-emerald-700">{formatBytes(result.compressedSize)}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-slate-500">Saving</span>
          <span className="text-sm font-medium text-emerald-600">-{savings}%</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-slate-500">Format</span>
          <span className="text-sm font-medium text-slate-700">{formatLabel}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-slate-500">Dimensions</span>
          <span className="text-sm font-medium text-slate-700">
            {result.width}×{result.height}
          </span>
        </div>
      </div>

      {/* Uploaded URL */}
      {uploadedUrl && (
        <div className="border-t border-slate-100 px-4 py-3">
          <p className="mb-1 text-xs text-slate-500">Uploaded URL</p>
          <p className="break-all text-xs text-emerald-700">{uploadedUrl}</p>
        </div>
      )}

      {/* Reset */}
      <div className="border-t border-slate-100 px-4 py-3">
        <button
          type="button"
          onClick={onReset}
          className="w-full rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          Upload Another
        </button>
      </div>
    </div>
  )
}

export default UploadResultCard
