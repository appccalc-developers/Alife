import { ImagePlus, X } from 'lucide-react'
import type { ForumMediaItem } from '../../types/forum'
import { isImageFile, isVideoFile, uploadForumMedia } from '../../services/imageWorkerApi'
import { forumCopy } from './forumCopy'

export type PendingForumMedia = {
  id: string
  file: File
  previewUrl: string
  kind: 'image' | 'video'
}

export const selectForumMedia = (
  files: FileList | File[],
  existing: PendingForumMedia[],
  language: string,
  mode: 'post' | 'comment',
): { items: PendingForumMedia[]; error: string } => {
  const text = forumCopy(language)
  const nextFiles = Array.from(files)
  const limit = mode === 'post' ? 9 : 1
  const all = [...existing]

  for (const file of nextFiles) {
    const isVideo = isVideoFile(file)
    const isImage = isImageFile(file)
    if (!isImage && !isVideo) return { items: existing, error: text.commentImageOnly }
    all.push({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      kind: isVideo ? 'video' : 'image',
    })
  }

  if (all.length > limit) return { items: existing, error: text.tooManyMedia }
  if (mode === 'post' && all.filter((item) => item.kind === 'video').length > 1) return { items: existing, error: text.tooManyVideos }

  return { items: all, error: '' }
}

export const uploadPendingForumMedia = async (
  items: PendingForumMedia[],
  folderPath: string,
): Promise<ForumMediaItem[]> =>
  Promise.all(items.map(async (item) => {
    const uploaded = await uploadForumMedia(item.file, folderPath)
    return {
      kind: uploaded.kind,
      url: uploaded.url,
      key: uploaded.key,
      name: item.file.name,
      contentType: item.file.type || uploaded.contentType,
      sizeBytes: uploaded.size || item.file.size,
    }
  }))

export const ForumMediaPicker = ({
  items,
  language,
  mode,
  disabled,
  onAdd,
  onRemove,
}: {
  items: PendingForumMedia[]
  language: string
  mode: 'post' | 'comment'
  disabled?: boolean
  onAdd: (files: FileList) => void
  onRemove: (id: string) => void
}) => {
  const text = forumCopy(language)
  const accept = 'image/*,video/*'

  return (
    <div className="mt-3">
      <label className="inline-flex min-h-10 cursor-pointer items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-black text-slate-700 shadow-sm transition hover:border-[#176b5a]/30 hover:text-[#176b5a]">
        <ImagePlus className="mr-2 h-4 w-4" aria-hidden="true" />
        {text.addMedia}
        <input
          type="file"
          accept={accept}
          multiple={mode === 'post'}
          className="sr-only"
          disabled={disabled}
          onChange={(event) => {
            if (event.target.files) onAdd(event.target.files)
            event.currentTarget.value = ''
          }}
        />
      </label>
      <p className="mt-1 text-xs font-semibold text-slate-500">{mode === 'post' ? text.mediaRulePost : text.mediaRuleComment}</p>
      {items.length > 0 ? (
        <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
          {items.map((item) => (
            <div key={item.id} className="group relative aspect-square overflow-hidden rounded-xl bg-slate-100">
              {item.kind === 'video' ? (
                <video src={item.previewUrl} className="h-full w-full object-cover" muted playsInline />
              ) : (
                <img src={item.previewUrl} alt={item.file.name} className="h-full w-full object-cover" />
              )}
              <button
                type="button"
                className="absolute right-1 top-1 inline-flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white transition hover:bg-black"
                aria-label={text.removeMedia}
                onClick={() => onRemove(item.id)}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export const ForumMediaGrid = ({ media }: { media: ForumMediaItem[] }) => {
  if (media.length === 0) return null

  return (
    <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {media.map((item, index) => (
        <div key={`${item.url}-${index}`} className="overflow-hidden rounded-2xl bg-slate-100">
          {item.kind === 'video' ? (
            <video src={item.url} className="aspect-square w-full object-cover" controls preload="metadata" />
          ) : (
            <img src={item.url} alt={item.name || ''} className="aspect-square w-full object-cover" loading="lazy" />
          )}
        </div>
      ))}
    </div>
  )
}
