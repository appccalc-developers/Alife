import React, { useCallback, useRef } from 'react'
import Cropper from 'react-easy-crop'
import type { Area, Point } from 'react-easy-crop'
import { useUiText } from '../../i18n/uiText'

type CropperDialogProps = {
  imageSrc: string
  crop: Point
  zoom: number
  aspectRatio: number
  isProcessing: boolean
  onCropChange: (location: Point) => void
  onZoomChange: (zoom: number) => void
  onCropComplete: (croppedArea: Area, croppedAreaPixels: Area) => void
  onUpload: () => void
  onCancel: () => void
}

const CropperDialog: React.FC<CropperDialogProps> = ({
  imageSrc,
  crop,
  zoom,
  aspectRatio,
  isProcessing,
  onCropChange,
  onZoomChange,
  onCropComplete,
  onUpload,
  onCancel,
}) => {
  const t = useUiText()
  const containerRef = useRef<HTMLDivElement>(null)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !isProcessing) {
        onUpload()
      }
      if (e.key === 'Escape') {
        onCancel()
      }
    },
    [isProcessing, onUpload, onCancel],
  )

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col bg-black/90"
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-3 py-1.5 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
          disabled={isProcessing}
        >
          Cancel
        </button>
        <span className="text-sm font-medium">Adjust Image</span>
        <button
          type="button"
          onClick={onUpload}
          disabled={isProcessing}
          className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {isProcessing ? 'Processing…' : 'Upload'}
        </button>
      </div>

      {/* Cropper */}
      <div className="relative flex-1">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspectRatio}
          onCropChange={onCropChange}
          onZoomChange={onZoomChange}
          onCropComplete={onCropComplete}
          zoomWithScroll={false}
          style={{
            containerStyle: {
              width: '100%',
              height: '100%',
              backgroundColor: '#000',
            },
          }}
        />
      </div>

      {/* Zoom slider */}
      <div className="flex items-center gap-4 px-6 py-4 text-white">
        <svg className="h-5 w-5 shrink-0 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
          <path d="M11 8v6" />
          <path d="M8 11h6" />
        </svg>
        <input
          type="range"
          value={zoom}
          min={1}
          max={3}
          step={0.05}
          onChange={(e) => onZoomChange(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/20 accent-emerald-500
            [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-md
            [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:shadow-md"
          aria-label={t('zoom')}
        />
        <svg className="h-5 w-5 shrink-0 text-white/60" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
          <path d="M11 8v6" />
        </svg>
      </div>

      {/* Processing overlay */}
      {isProcessing && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/60">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-white" />
          <p className="text-sm font-medium text-white">{t('processingImage')}</p>
        </div>
      )}
    </div>
  )
}

export default CropperDialog
