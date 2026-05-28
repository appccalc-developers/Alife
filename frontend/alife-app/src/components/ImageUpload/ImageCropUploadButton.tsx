import React, { useState, useCallback, useRef } from 'react'
import Cropper from 'react-easy-crop'
import { useUiText } from '../../i18n/uiText'
import { useImageUpload } from '../../hooks/useImageUpload'

type ImageCropUploadButtonProps = {
  /** Called with the processed image data URL (compressed & cropped) */
  onImageReady: (dataUrl: string) => void
  disabled?: boolean
  aspectRatio?: number
  children?: React.ReactNode
}

/**
 * A button that opens a crop dialog when a file is selected.
 * After cropping and compression, it returns a data URL via onImageReady.
 * Embeds crop+compress into editors that work with data URLs.
 */
const ImageCropUploadButton: React.FC<ImageCropUploadButtonProps> = ({
  onImageReady,
  disabled = false,
  aspectRatio = 16 / 9,
  children,
}) => {
  const t = useUiText()
  const [showCropper, setShowCropper] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const {
    imageSrc,
    crop,
    zoom,
    isProcessing,
    error,
    uploadProgress,
    setCrop,
    setZoom,
    onCropComplete,
    selectFile,
    process,
    reset,
  } = useImageUpload({
    maxFileSize: 10,
    aspectRatio,
  })

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      selectFile(file)
      setShowCropper(true)
      e.target.value = ''
    },
    [selectFile],
  )

  const handleApply = useCallback(async () => {
    try {
      const result = await process()
      // Convert the compressed File to a data URL for the editor
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = typeof reader.result === 'string' ? reader.result : ''
        if (dataUrl) {
          onImageReady(dataUrl)
        }
        setShowCropper(false)
        reset()
      }
      reader.readAsDataURL(result.file)
    } catch {
      // Error is handled in the hook
    }
  }, [process, onImageReady, reset])

  const handleCancel = useCallback(() => {
    setShowCropper(false)
    reset()
  }, [reset])

  const handleClick = useCallback(() => {
    inputRef.current?.click()
  }, [])

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className="h-9 w-full rounded border border-slate-300 px-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-slate-200 file:px-2 file:py-1 file:text-xs file:font-medium disabled:bg-slate-100 hover:bg-slate-100 transition-colors"
      >
        {children || 'Select & Crop Image'}
      </button>

      {/* Cropper fullscreen dialog */}
      {showCropper && imageSrc && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 text-white shrink-0">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
              disabled={isProcessing}
            >
              Cancel
            </button>
            <span className="text-sm font-medium">Crop Image</span>
            <button
              type="button"
              onClick={handleApply}
              disabled={isProcessing}
              className="rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {isProcessing ? `Compressing ${uploadProgress}%` : 'Apply'}
            </button>
          </div>

          {/* Cropper area - takes remaining space */}
          <div className="relative flex-1 min-h-0">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspectRatio}
              onCropChange={setCrop}
              onZoomChange={setZoom}
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
          <div className="flex items-center gap-4 px-6 py-4 text-white shrink-0">
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
              onChange={(e) => setZoom(Number(e.target.value))}
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
              <p className="text-sm font-medium text-white">{t('compressingImageProgress', { progress: uploadProgress })}</p>
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      )}
    </>
  )
}

export default ImageCropUploadButton
