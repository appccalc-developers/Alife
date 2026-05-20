import React, { useCallback } from 'react'
import { useImageUpload } from '../../hooks/useImageUpload'
import CropperDialog from './CropperDialog'
import ImageUploadButton from './ImageUploadButton'
import UploadResultCard from './UploadResultCard'
import ProcessingOverlay from './ProcessingOverlay'
import type { UploadedImage } from '../../services/imageWorkerApi'

type ImageUploadFlowProps = {
  /** Called with the processed file + uploaded image metadata */
  onUploadComplete?: (file: File, image: UploadedImage) => void
  /** Called with just the data URL for local preview use (before upload) */
  onLocalPreview?: (dataUrl: string) => void
  /** Max input file size in MB (default: 10) */
  maxFileSize?: number
  /** Aspect ratio for cropping (default: 4/3) */
  aspectRatio?: number
  /** Whether to show the upload result card */
  showResult?: boolean
  /** Extra CSS classes for the container */
  className?: string
  /** Custom render trigger button */
  renderTrigger?: (onClick: () => void) => React.ReactNode
}

/**
 * Full image upload flow:
 * 1. Select file
 * 2. Crop with touch gestures
 * 3. Compress client-side
 * 4. Upload to Cloudflare Worker
 * 5. Show result
 */
const ImageUploadFlow: React.FC<ImageUploadFlowProps> = ({
  onUploadComplete,
  onLocalPreview,
  maxFileSize = 10,
  aspectRatio = 4 / 3,
  showResult = true,
  className = '',
  renderTrigger,
}) => {
  const {
    imageSrc,
    crop,
    zoom,
    isProcessing,
    error,
    uploadProgress,
    compressionResult,
    setCrop,
    setZoom,
    onCropComplete,
    selectFile,
    uploadToWorker,
    reset,
  } = useImageUpload({
    maxFileSize,
    aspectRatio,
  })

  const [uploadedImage, setUploadedImage] = React.useState<UploadedImage | null>(null)

  // Handle file select from button
  const handleFileSelect = useCallback(
    (file: File) => {
      selectFile(file)
      if (onLocalPreview) {
        const url = URL.createObjectURL(file)
        onLocalPreview(url)
        // Cleanup after a short delay — the caller gets a sync data URL
        setTimeout(() => URL.revokeObjectURL(url), 1000)
      }
    },
    [selectFile, onLocalPreview],
  )

  // Handle upload
  const handleUpload = useCallback(async () => {
    try {
      const result = await uploadToWorker()
      setUploadedImage(result.image)
      onUploadComplete?.(result.file, result.image)
    } catch {
      // Error is set in the hook
    }
  }, [uploadToWorker, onUploadComplete])

  // Handle button trigger click
  const handleTriggerClick = useCallback(() => {
    // The ImageUploadButton handles its own file input
  }, [])

  // Error state
  if (error) {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          Try Again
        </button>
      </div>
    )
  }

  // Cropper stage
  if (imageSrc && !compressionResult) {
    return (
      <div className={className}>
        <CropperDialog
          imageSrc={imageSrc}
          crop={crop}
          zoom={zoom}
          aspectRatio={aspectRatio}
          isProcessing={isProcessing}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          onUpload={handleUpload}
          onCancel={reset}
        />
      </div>
    )
  }

  // Processing stage
  if (isProcessing) {
    return (
      <div className={`${className}`}>
        <ProcessingOverlay progress={uploadProgress} />
      </div>
    )
  }

  // Result stage
  if (compressionResult && showResult) {
    return (
      <div className={`space-y-4 ${className}`}>
        <UploadResultCard
          result={compressionResult}
          uploadedUrl={uploadedImage?.url}
          onReset={reset}
        />
      </div>
    )
  }

  // Initial state
  return (
    <div className={className}>
      {renderTrigger ? (
        renderTrigger(handleTriggerClick)
      ) : (
        <ImageUploadButton onFileSelect={handleFileSelect}>
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          Upload Image
        </ImageUploadButton>
      )}
    </div>
  )
}

export default ImageUploadFlow
