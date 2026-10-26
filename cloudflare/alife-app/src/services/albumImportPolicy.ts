export const MAX_PHOTOS = 50
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024
export const MAX_BATCH_BYTES = 100 * 1024 * 1024
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type ImportFailure = 'configuration' | 'authorization' | 'expired' | 'unavailable' | 'limit' | 'invalid' | 'changed' | 'upload'
export class AlbumImportError extends Error {
  code: ImportFailure
  constructor(code: ImportFailure) { super(code); this.code = code }
}
export function validatePhotoBatch(files: { size: number; type: string }[]) {
  if (!files.length || files.length > MAX_PHOTOS || files.some(f => f.size <= 0 || f.size > MAX_PHOTO_BYTES) ||
      files.reduce((sum, f) => sum + f.size, 0) > MAX_BATCH_BYTES) throw new AlbumImportError('limit')
  if (files.some(f => !(PHOTO_TYPES as readonly string[]).includes(f.type))) throw new AlbumImportError('invalid')
}

export async function validateDecodedPhoto(file: File) {
  validatePhotoBatch([file])
  try {
    const bitmap = await createImageBitmap(file)
    const valid = bitmap.width > 0 && bitmap.height > 0 && bitmap.width * bitmap.height <= 40_000_000
    bitmap.close()
    if (!valid) throw new Error()
  } catch { throw new AlbumImportError('invalid') }
}
