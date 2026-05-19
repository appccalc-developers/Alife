import { useState, useCallback, useRef } from 'react'
import type { Area, Point } from 'react-easy-crop'
import imageCompression from 'browser-image-compression'
import { uploadImage } from '../services/imageWorkerApi'

export type CompressionResult = {
  file: File
  originalSize: number
  compressedSize: number
  format: string
  width: number
  height: number
}

type UseImageUploadOptions = {
  maxFileSize?: number
  targetMaxSizeMB?: number
  maxDimension?: number
  quality?: number
  fileType?: string
  aspectRatio?: number
}

export function useImageUpload(options: UseImageUploadOptions = {}) {
  const {
    maxFileSize = 10,
    targetMaxSizeMB = 1.5,
    maxDimension = 2048,
    quality = 0.85,
    fileType = 'image/webp',
    aspectRatio = 4 / 3,
  } = options

  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [originalFile, setOriginalFile] = useState<File | null>(null)
  const [compressionResult, setCompressionResult] = useState<CompressionResult | null>(null)

  const objectUrlRef = useRef<string | null>(null)

  const cleanupObjectUrl = useCallback(() => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
      objectUrlRef.current = null
    }
  }, [])

  const reset = useCallback(() => {
    cleanupObjectUrl()
    setImageSrc(null)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setCroppedAreaPixels(null)
    setIsProcessing(false)
    setError(null)
    setUploadProgress(0)
    setOriginalFile(null)
    setCompressionResult(null)
  }, [cleanupObjectUrl])

  const selectFile = useCallback(
    (file: File) => {
      if (file.size > maxFileSize * 1024 * 1024) {
        setError(`File size must be less than ${maxFileSize}MB`)
        return
      }
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file')
        return
      }

      setError(null)
      setOriginalFile(file)
      cleanupObjectUrl()

      const objectUrl = URL.createObjectURL(file)
      objectUrlRef.current = objectUrl
      setImageSrc(objectUrl)
    },
    [maxFileSize, cleanupObjectUrl],
  )

  const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels)
  }, [])

  const createImage = useCallback((url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = url
    })
  }, [])

  const getCroppedBlob = useCallback(
    async (imageSrc: string, pixelCrop: Area): Promise<Blob> => {
      const image = await createImage(imageSrc)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Canvas context not available')

      canvas.width = pixelCrop.width
      canvas.height = pixelCrop.height
      ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height,
      )

      return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Canvas to Blob conversion failed'))
          },
          'image/jpeg',
          0.95,
        )
      })
    },
    [createImage],
  )

  const compressBlob = useCallback(
    async (blob: Blob): Promise<CompressionResult> => {
      const compressedResult = await imageCompression(blob as File, {
        maxSizeMB: targetMaxSizeMB,
        maxWidthOrHeight: maxDimension,
        useWebWorker: true,
        fileType,
        initialQuality: quality,
        onProgress: (progress: number) => {
          setUploadProgress(Math.round(progress))
        },
      })

      const ext = fileType === 'image/webp' ? 'webp' : 'jpg'
      const filename = `upload_${Date.now()}.${ext}`
      const compressedFile = new File([compressedResult], filename, {
        type: compressedResult.type || fileType,
      })

      const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
        const url = URL.createObjectURL(compressedResult)
        const img = new Image()
        img.onload = () => {
          URL.revokeObjectURL(url)
          resolve({ width: img.width, height: img.height })
        }
        img.onerror = () => {
          URL.revokeObjectURL(url)
          reject(new Error('Failed to decode compressed image'))
        }
        img.src = url
      })

      return {
        file: compressedFile,
        originalSize: blob.size,
        compressedSize: compressedFile.size,
        format: compressedFile.type,
        width: dims.width,
        height: dims.height,
      }
    },
    [targetMaxSizeMB, maxDimension, fileType, quality],
  )

  const process = useCallback(async (): Promise<CompressionResult> => {
    if (!imageSrc || !croppedAreaPixels) {
      throw new Error('No image selected or crop area not defined')
    }

    setIsProcessing(true)
    setError(null)
    setUploadProgress(0)

    try {
      const croppedBlob = await getCroppedBlob(imageSrc, croppedAreaPixels)
      const result = await compressBlob(croppedBlob)
      setCompressionResult(result)

      console.log('[useImageUpload] Processed:', {
        originalSize: `${(result.originalSize / 1024 / 1024).toFixed(2)}MB`,
        compressedSize: `${(result.compressedSize / 1024 / 1024).toFixed(2)}MB`,
        format: result.format,
        dimensions: `${result.width}x${result.height}`,
      })

      return result
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Image processing failed'
      setError(message)
      throw err
    } finally {
      setIsProcessing(false)
    }
  }, [imageSrc, croppedAreaPixels, getCroppedBlob, compressBlob])

  const uploadToWorker = useCallback(async (): Promise<{ file: File; image: import('../services/imageWorkerApi').UploadedImage }> => {
    const result = await process()
    const image = await uploadImage(result.file)
    cleanupObjectUrl()
    return { file: result.file, image }
  }, [process, cleanupObjectUrl])

  return {
    imageSrc,
    crop,
    zoom,
    isProcessing,
    error,
    uploadProgress,
    originalFile,
    compressionResult,
    setCrop,
    setZoom,
    onCropComplete,
    selectFile,
    process,
    uploadToWorker,
    reset,
    cleanupObjectUrl,
    aspectRatio,
  }
}
