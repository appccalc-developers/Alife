import { useEffect, useId, useMemo, useState } from 'react'
import { Editor } from '@tinymce/tinymce-react'
import { uploadImage, uploadedImageToAppPath } from '../../services/imageWorkerApi'

import 'tinymce/tinymce'
import 'tinymce/icons/default'
import 'tinymce/models/dom'
import 'tinymce/themes/silver'
import 'tinymce/plugins/autolink'
import 'tinymce/plugins/image'
import 'tinymce/plugins/link'
import 'tinymce/plugins/lists'
import 'tinymce/skins/ui/oxide/skin.min.css'
import 'tinymce/skins/ui/oxide/content.min.css'

type TinyMceRichTextEditorProps = {
  value: string
  label: string
  placeholder: string
  disabled?: boolean
  compact?: boolean
  imageUploadFolder?: string
  onChange: (value: string) => void
}

type TinyMceBlobInfo = {
  blob: () => Blob
  filename: () => string
}

type TinyMceFilePickerCallback = (url: string, meta?: Record<string, string>) => void
type TinyMceFilePickerMeta = { filetype?: string }

const extensionFromFileName = (fileName: string, fallback = 'jpg') => {
  const normalized = fileName.toLowerCase()
  const extension = normalized.split('.').at(-1) ?? ''
  return extension && extension !== normalized ? extension : fallback
}

const randomSuffix = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const toUniqueImageFile = (source: Blob, sourceFileName = 'rich-text-image') => {
  const originalName = source instanceof File ? source.name : sourceFileName
  const extension = extensionFromFileName(originalName)

  return new File([source], `rich-text-${Date.now()}-${randomSuffix()}.${extension}`, {
    type: source.type || 'image/jpeg',
  })
}

const editorContentStyle = [
  'body { color: #334155; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; font-size: 15px; line-height: 1.7; margin: 12px; }',
  'p { margin: 0 0 12px; }',
  'p:last-child { margin-bottom: 0; }',
  'h2, h3, h4 { color: #0f172a; line-height: 1.25; margin: 18px 0 8px; }',
  'h2 { font-size: 24px; }',
  'h3 { font-size: 20px; }',
  'h4 { font-size: 17px; }',
  'blockquote { border-left: 3px solid #059669; color: #475569; margin: 16px 0; padding-left: 14px; }',
  'ul, ol { margin: 0 0 12px 22px; padding: 0; }',
  'li { margin: 4px 0; }',
  'a { color: #047857; }',
  'img { display: block; height: auto; margin: 16px 0; max-width: 100%; }',
].join(' ')

const TinyMceRichTextEditor = ({ value, label, placeholder, disabled, compact, imageUploadFolder, onChange }: TinyMceRichTextEditorProps) => {
  const reactId = useId()
  const editorId = `rich-text-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    setDraft(value)
  }, [value])

  const uploadForEditor = async (source: Blob, sourceFileName?: string) => {
    const file = toUniqueImageFile(source, sourceFileName)
    const uploaded = await uploadImage(file, imageUploadFolder || 'pages/draft/rich-text')
    return uploadedImageToAppPath(uploaded)
  }

  const init = useMemo(() => ({
    height: compact ? 250 : 320,
    menubar: false,
    statusbar: false,
    branding: false,
    promotion: false,
    skin: false,
    content_css: false,
    plugins: 'autolink image link lists',
    toolbar: 'undo redo | blocks | bold italic underline | alignleft aligncenter alignright alignjustify | bullist numlist blockquote | link image | removeformat',
    block_formats: 'Paragraph=p; Heading 2=h2; Heading 3=h3; Heading 4=h4',
    placeholder,
    invalid_elements: 'script,iframe,object,embed,form,input,button,textarea,select,style,link,meta',
    valid_elements: 'p,br,strong/b,em/i,u,s,a[href|target|rel|title],blockquote,ul,ol,li,h2,h3,h4,hr,pre,code,img[src|alt|title|width|height]',
    default_link_target: '_blank',
    automatic_uploads: true,
    images_reuse_filename: false,
    image_title: true,
    image_advtab: false,
    image_dimensions: true,
    image_uploadtab: true,
    object_resizing: 'img',
    resize_img_proportional: true,
    file_picker_types: 'image',
    images_upload_handler: async (blobInfo: TinyMceBlobInfo) => uploadForEditor(blobInfo.blob(), blobInfo.filename()),
    file_picker_callback: (callback: TinyMceFilePickerCallback, _value: string, meta: TinyMceFilePickerMeta) => {
      if (meta.filetype !== 'image') {
        return
      }

      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.addEventListener('change', () => {
        const file = input.files?.[0]
        if (!file) {
          return
        }

        uploadForEditor(file, file.name)
          .then((url) => callback(url, { alt: file.name, title: file.name }))
          .catch((error) => {
            console.error('TinyMCE image upload failed.', error)
          })
      })
      input.click()
    },
    target_list: [
      { title: 'Current window', value: '' },
      { title: 'New window', value: '_blank' },
    ],
    rel_list: [
      { title: 'No opener', value: 'noopener noreferrer' },
    ],
    formats: {
      underline: { inline: 'u' },
      strikethrough: { inline: 's' },
    },
    content_style: editorContentStyle,
  }), [compact, imageUploadFolder, placeholder])

  const commitDraft = () => {
    if (draft !== value) {
      onChange(draft)
    }
  }

  return (
    <label className="block space-y-1 md:col-span-2" data-editor-focus-target="true" tabIndex={-1}>
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <Editor
        id={editorId}
        value={draft}
        disabled={disabled}
        licenseKey="gpl"
        rollback={false}
        init={init}
        onEditorChange={(nextValue) => setDraft(nextValue)}
        onBlur={commitDraft}
      />
    </label>
  )
}

export default TinyMceRichTextEditor
