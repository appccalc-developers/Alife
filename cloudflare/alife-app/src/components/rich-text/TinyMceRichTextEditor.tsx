import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Editor } from '@tinymce/tinymce-react'
import type { Editor as TinyMceEditor } from 'tinymce'
import { uploadImage, uploadedImageToAppPath } from '../../services/imageWorkerApi'
import MediaPickerInput, { type MediaPickerInputHandle } from '../media/MediaPickerInput'

import 'tinymce/tinymce'
import 'tinymce/icons/default'
import 'tinymce/models/dom'
import 'tinymce/themes/silver'
import 'tinymce/plugins/autolink'
import 'tinymce/plugins/autoresize'
import 'tinymce/plugins/image'
import 'tinymce/plugins/link'
import 'tinymce/plugins/lists'
import 'tinymce/skins/ui/oxide/skin.min.css'
import 'tinymce/skins/ui/oxide/content.min.css'

type TinyMceRichTextEditorProps = {
  value: string
  placeholder: string
  appearance?: 'body' | 'bodyOverlay' | 'quoteOverlay'
  disabled?: boolean
  compact?: boolean
  imageUploadFolder?: string
  imagePickerLabel: string
  groupId?: string
  onChange: (value: string) => void
}

type TinyMceBlobInfo = {
  blob: () => Blob
  filename: () => string
}

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

const sharedDisplayContentStyle = [
  'html { background: transparent; }',
  'body { box-sizing: border-box; display: flow-root; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; min-width: 0; overflow-wrap: break-word; padding: 12px; }',
  '* { box-sizing: border-box; }',
  'a { font-weight: 600; text-decoration: underline; text-underline-offset: 2px; }',
  'blockquote { border-left-style: solid; border-left-width: 4px; margin: 20px 0; padding-left: 16px; }',
  'h2, h3, h4 { font-weight: 700; line-height: 1.25; }',
  'h2 { font-size: 24px; margin: 24px 0 12px; }',
  'h3 { font-size: 20px; margin: 20px 0 8px; }',
  'h4 { font-size: 18px; margin: 16px 0 8px; }',
  'hr { border: 0; border-top: 1px solid #e2e8f0; margin: 24px 0; }',
  'img { border: 1px solid #e2e8f0; border-radius: 8px; display: block; height: auto; margin: 20px 0; max-width: 100%; }',
  'img[style*="float: left"], img[style*="float:left"] { margin: 4px 20px 12px 0; }',
  'img[style*="float: right"], img[style*="float:right"] { margin: 4px 0 12px 20px; }',
  'li { margin: 4px 0; }',
  'ol { list-style: decimal; }',
  'ul { list-style: disc; }',
  'ol, ul { margin: 0 0 16px; padding-left: 24px; }',
  'p { margin: 0 0 16px; }',
  'p:last-child { margin-bottom: 0; }',
].join(' ')

const editorAppearanceContentStyle: Record<NonNullable<TinyMceRichTextEditorProps['appearance']>, string> = {
  body: [
    'body { color: #334155; font-size: 16px; font-style: normal; line-height: 1.75; text-align: left; }',
    'a { color: #047857; }',
    'blockquote { border-left-color: #10b981; color: #475569; }',
    '.mce-content-body[data-mce-placeholder]:not(.mce-visualblocks)::before { color: #94a3b8; }',
  ].join(' '),
  bodyOverlay: [
    'body { color: #f1f5f9; font-size: 16px; font-style: normal; font-weight: 400; line-height: 1.75; text-align: left; }',
    'a { color: #fef08a; }',
    'blockquote { border-left-color: #fde047; color: #e2e8f0; }',
    '.mce-content-body[data-mce-placeholder]:not(.mce-visualblocks)::before { color: rgba(241, 245, 249, 0.72); }',
  ].join(' '),
  quoteOverlay: [
    'body { color: #f1f5f9; font-size: 24px; font-style: italic; line-height: 1.625; margin: 0 auto; max-width: 48rem; text-align: center; }',
    '@media (min-width: 640px) { body { font-size: 36px; } }',
    'a { color: #fef08a; }',
    'blockquote { border-left-color: #fde047; color: #f1f5f9; }',
    '.mce-content-body[data-mce-placeholder]:not(.mce-visualblocks)::before { color: rgba(241, 245, 249, 0.72); }',
  ].join(' '),
}

const editorContentStyle = (appearance: NonNullable<TinyMceRichTextEditorProps['appearance']>) => [
  sharedDisplayContentStyle,
  editorAppearanceContentStyle[appearance],
].join(' ')

const escapeHtmlAttribute = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/"/g, '&quot;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')

const TinyMceRichTextEditor = ({ value, placeholder, appearance = 'body', disabled, compact, imageUploadFolder, imagePickerLabel, groupId, onChange }: TinyMceRichTextEditorProps) => {
  const reactId = useId()
  const editorId = `rich-text-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`
  const [draft, setDraft] = useState(value)
  const mediaPickerRef = useRef<MediaPickerInputHandle>(null)
  const editorRef = useRef<TinyMceEditor | null>(null)
  const selectedImageRef = useRef<HTMLImageElement | null>(null)
  const minHeight = compact ? 250 : 320

  useEffect(() => {
    setDraft(value)
  }, [value])

  const uploadForEditor = async (source: Blob, sourceFileName?: string) => {
    const file = toUniqueImageFile(source, sourceFileName)
    const uploaded = await uploadImage(file, imageUploadFolder || 'pages/draft/rich-text')
    return uploadedImageToAppPath(uploaded)
  }

  const init = useMemo(() => ({
    height: minHeight,
    min_height: minHeight,
    menubar: false,
    statusbar: false,
    branding: false,
    promotion: false,
    skin: false,
    content_css: false,
    plugins: 'autolink autoresize image link lists',
    autoresize_bottom_margin: 24,
    autoresize_overflow_padding: 0,
    toolbar: 'undo redo | blocks | bold italic underline | alignleft aligncenter alignright alignjustify | bullist numlist blockquote | link appimage | removeformat',
    contextmenu: 'link appimage',
    block_formats: 'Paragraph=p; Heading 2=h2; Heading 3=h3; Heading 4=h4',
    placeholder,
    iframe_attrs: appearance !== 'body' ? { allowtransparency: 'true', style: 'background-color: transparent;' } : undefined,
    invalid_elements: 'script,iframe,object,embed,form,input,button,textarea,select,style,link,meta',
    valid_elements: 'p,br,strong/b,em/i,u,s,a[href|target|rel|title],blockquote,ul,ol,li,h2,h3,h4,hr,pre,code,img[src|alt|title|width|height|style]',
    valid_styles: {
      img: 'width,height,float,display,margin-left,margin-right,margin-top,margin-bottom',
    },
    default_link_target: '_blank',
    automatic_uploads: true,
    images_reuse_filename: false,
    image_title: true,
    image_advtab: false,
    image_dimensions: true,
    image_uploadtab: true,
    object_resizing: 'img',
    resize_img_proportional: true,
    images_upload_handler: async (blobInfo: TinyMceBlobInfo) => uploadForEditor(blobInfo.blob(), blobInfo.filename()),
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
    setup: (editor: TinyMceEditor) => {
      editorRef.current = editor

      const openImagePicker = (target?: Node | null) => {
        selectedImageRef.current = target?.nodeName === 'IMG' ? target as HTMLImageElement : null
        mediaPickerRef.current?.open()
      }
      const openForSelection = () => openImagePicker(editor.selection.getNode())

      editor.ui.registry.addToggleButton('appimage', {
        icon: 'image',
        tooltip: imagePickerLabel,
        onAction: openForSelection,
        onSetup: (buttonApi) => {
          const binding = editor.selection.selectorChangedWithUnbind('img', buttonApi.setActive)
          return binding.unbind
        },
      })
      editor.ui.registry.addMenuItem('appimage', {
        icon: 'image',
        text: imagePickerLabel,
        onAction: openForSelection,
      })
      editor.ui.registry.addContextMenu('appimage', {
        update: (element) => element.nodeName === 'IMG' ? ['appimage'] : [],
      })
      editor.on('dblclick', (event) => {
        if ((event.target as Node | null)?.nodeName === 'IMG') {
          openImagePicker(event.target as Node)
        }
      })
    },
    content_style: editorContentStyle(appearance),
  }), [appearance, imagePickerLabel, imageUploadFolder, minHeight, placeholder])

  const commitDraft = () => {
    if (draft !== value) {
      onChange(draft)
    }
  }

  return (
    <>
      <div
        className="block md:col-span-2 [&_.tox-tbtn--select]:!bg-slate-50 [&_.tox-tbtn--select]:!font-normal [&_.tox-tbtn--select]:!text-slate-700 [&_.tox-tbtn--select:hover]:!bg-slate-100"
        data-editor-focus-target="true"
        tabIndex={-1}
      >
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
      </div>
      <MediaPickerInput
        ref={mediaPickerRef}
        label={imagePickerLabel}
        value=""
        disabled={disabled}
        groupId={groupId}
        accept="image"
        pickerOnly
        onChange={(url) => {
          const editor = editorRef.current
          if (!editor) {
            return
          }

          const selectedNode = editor.selection.getNode()
          const currentImage = selectedNode.nodeName === 'IMG' ? selectedNode as HTMLImageElement : null
          const rememberedImage = selectedImageRef.current
          const targetImage = rememberedImage && editor.getBody().contains(rememberedImage) ? rememberedImage : currentImage

          editor.undoManager.transact(() => {
            if (targetImage) {
              editor.dom.setAttrib(targetImage, 'src', url)
              editor.dom.setAttrib(targetImage, 'data-mce-src', url)
              editor.selection.select(targetImage)
            } else {
              editor.insertContent(`<img src="${escapeHtmlAttribute(url)}" alt="" />`)
            }
          })
          selectedImageRef.current = null
          editor.nodeChanged()
          editor.focus()
        }}
      />
    </>
  )
}

export default TinyMceRichTextEditor
