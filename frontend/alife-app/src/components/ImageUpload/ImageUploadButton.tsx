import React, { useCallback, useRef } from 'react'

type ImageUploadButtonProps = {
  onFileSelect: (file: File) => void
  disabled?: boolean
  capture?: 'environment' | 'user'
  className?: string
  children?: React.ReactNode
}

const ImageUploadButton: React.FC<ImageUploadButtonProps> = ({
  onFileSelect,
  disabled = false,
  capture = 'environment',
  className = '',
  children,
}) => {
  const inputRef = useRef<HTMLInputElement>(null)
  const isProcessingRef = useRef(false)

  const handleClick = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (isProcessingRef.current) return
      isProcessingRef.current = true

      const file = e.target.files?.[0]
      if (file) {
        onFileSelect(file)
      }

      e.target.value = ''
      isProcessingRef.current = false
    },
    [onFileSelect],
  )

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture={capture}
        onChange={handleChange}
        className="hidden"
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className={`inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-medium
          transition focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2
          disabled:cursor-not-allowed disabled:opacity-50
          touch:min-h-[48px] ${className}`}
      >
        {children || (
          <>
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            Select Photo
          </>
        )}
      </button>
    </>
  )
}

export default ImageUploadButton
