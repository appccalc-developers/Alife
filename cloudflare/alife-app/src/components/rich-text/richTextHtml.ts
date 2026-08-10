const TEXT_NODE = 3
const ELEMENT_NODE = 1

const allowedRichTextTags = new Set([
  'a',
  'blockquote',
  'br',
  'code',
  'em',
  'h2',
  'h3',
  'h4',
  'hr',
  'img',
  'li',
  'ol',
  'p',
  'pre',
  's',
  'strong',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'caption',
  'col',
  'colgroup',
  'u',
  'ul',
])

const blockedRichTextTags = new Set([
  'button',
  'embed',
  'form',
  'iframe',
  'input',
  'link',
  'meta',
  'object',
  'script',
  'select',
  'style',
  'textarea',
])

export type RichTextAppearance = 'body' | 'bodyOverlay' | 'quoteOverlay' | 'spotlightBody'

export const richTextBodyClass = [
  'flow-root min-w-0 overflow-x-auto break-words',
  '[&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-2',
  '[&_blockquote]:my-5 [&_blockquote]:border-l-4 [&_blockquote]:border-emerald-500 [&_blockquote]:pl-4',
  '[&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:leading-tight',
  '[&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:leading-tight',
  '[&_h4]:mb-2 [&_h4]:mt-4 [&_h4]:text-lg [&_h4]:font-bold [&_h4]:leading-tight',
  '[&_hr]:my-6 [&_hr]:border-slate-200',
  '[&_img]:my-5 [&_img]:block [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-slate-200',
  '[&_li]:my-1',
  '[&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6',
  '[&_p]:mb-4 [&_p:last-child]:mb-0',
  '[&_table]:my-5 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left',
  '[&_caption]:mb-2 [&_caption]:text-left [&_caption]:font-semibold',
  '[&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-100/70 [&_th]:px-3 [&_th]:py-2 [&_th]:align-top [&_th]:font-bold',
  '[&_td]:border [&_td]:border-slate-300 [&_td]:px-3 [&_td]:py-2 [&_td]:align-top',
  '[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6',
].join(' ')

export const richTextAppearanceClass: Record<RichTextAppearance, string> = {
  body: 'text-base leading-7 text-slate-700 [&_a]:text-emerald-700 [&_blockquote]:text-slate-600',
  bodyOverlay: 'text-left text-base font-normal not-italic leading-7 text-slate-100 [&_a]:text-yellow-200 [&_blockquote]:border-yellow-300 [&_blockquote]:text-slate-200',
  quoteOverlay: 'text-center text-2xl italic leading-relaxed text-slate-100 sm:text-4xl [&_a]:text-yellow-200 [&_blockquote]:border-yellow-300 [&_blockquote]:text-slate-100',
  spotlightBody: 'text-[0.94rem] leading-7 text-home-muted [&_a]:text-home-green [&_blockquote]:border-home-green [&_blockquote]:text-home-muted',
}

const sharedEditorContentStyle = [
  'html { background: transparent; }',
  'body { box-sizing: border-box; display: flow-root; font-family: Inter, "Segoe UI Variable", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif; margin: 0; min-width: 0; overflow-wrap: break-word; overflow-x: auto; padding: 12px; }',
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
  'table { border-collapse: collapse; margin: 20px 0; width: 100%; }',
  'caption { font-weight: 600; margin-bottom: 8px; text-align: left; }',
  'th, td { border: 1px solid #cbd5e1; overflow-wrap: anywhere; padding: 8px 12px; text-align: left; vertical-align: top; }',
  'th { background: rgba(148, 163, 184, 0.16); font-weight: 700; }',
].join(' ')

const editorAppearanceContentStyle: Record<RichTextAppearance, string> = {
  body: [
    'body { color: #334155; font-size: 16px; font-style: normal; line-height: 1.75; text-align: left; }',
    'a { color: #047857; }',
    'blockquote { border-left-color: #10b981; color: #475569; }',
    '.mce-content-body[data-mce-placeholder]:not(.mce-visualblocks)::before { color: #94a3b8; }',
  ].join(' '),
  bodyOverlay: [
    'body { color: #f1f5f9; font-size: 16px; font-style: normal; font-weight: 400; line-height: 1.75; margin-left: auto; margin-right: auto; max-width: 48rem; text-align: left; }',
    'a { color: #fef08a; }',
    'blockquote { border-left-color: #fde047; color: #e2e8f0; }',
    '.mce-content-body[data-mce-placeholder]:not(.mce-visualblocks)::before { color: rgba(241, 245, 249, 0.72); }',
  ].join(' '),
  quoteOverlay: [
    'body { color: #f1f5f9; font-size: 24px; font-style: italic; line-height: 1.625; margin-left: auto; margin-right: auto; max-width: 48rem; text-align: center; }',
    '@media (min-width: 640px) { body { font-size: 36px; } }',
    'a { color: #fef08a; }',
    'blockquote { border-left-color: #fde047; color: #f1f5f9; }',
    '.mce-content-body[data-mce-placeholder]:not(.mce-visualblocks)::before { color: rgba(241, 245, 249, 0.72); }',
  ].join(' '),
  spotlightBody: [
    'body { color: #675846; font-size: 15.04px; font-style: normal; font-weight: 400; line-height: 28px; text-align: left; }',
    'a { color: #2f6f62; }',
    'blockquote { border-left-color: #2f6f62; color: #675846; }',
    '.mce-content-body[data-mce-placeholder]:not(.mce-visualblocks)::before { color: #8b7a66; }',
  ].join(' '),
}

export const richTextEditorContentStyle = (appearance: RichTextAppearance) => [
  sharedEditorContentStyle,
  editorAppearanceContentStyle[appearance],
].join(' ')

const hasHtmlMarkup = (value: string) => /<\/?[a-z][\s\S]*>/i.test(value)

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const isSafeHref = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) {
    return false
  }

  if (trimmed.startsWith('#') || /^\/(?!\/)/.test(trimmed) || /^\.{1,2}\//.test(trimmed)) {
    return true
  }

  try {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://alife.local'
    const url = new URL(trimmed, baseUrl)
    return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'mailto:' || url.protocol === 'tel:'
  } catch {
    return false
  }
}

const isSafeImageSrc = (value: string) => {
  const trimmed = value.trim()
  if (!trimmed) {
    return false
  }

  if (/^\/images\/(?!\/)/.test(trimmed)) {
    return true
  }

  try {
    const url = new URL(trimmed, typeof window !== 'undefined' ? window.location.origin : 'https://ccalc.live')
    return (
      (url.hostname === 'ccalc.live' && url.pathname.startsWith('/images/')) ||
      url.hostname === 'images.ccalc.live' ||
      (url.protocol === 'https:' && url.hostname === 'pages.nzalc.org')
    )
  } catch {
    return false
  }
}

const imageSrcToAppPath = (value: string) => {
  try {
    const url = new URL(value, typeof window !== 'undefined' ? window.location.origin : 'https://ccalc.live')
    if (url.hostname === 'images.ccalc.live') {
      return `/images${url.pathname}${url.search}${url.hash}`
    }
    if (url.hostname === 'ccalc.live' && url.pathname.startsWith('/images/')) {
      return `${url.pathname}${url.search}${url.hash}`
    }
  } catch {
    return value
  }

  return value
}

const sanitizeDimension = (value: string | null) => {
  if (!value) {
    return ''
  }

  const trimmed = value.trim()
  return /^\d{1,4}$/.test(trimmed) ? trimmed : ''
}

const sanitizeCssSize = (value: string, allowAuto = false) => {
  const normalized = value.trim().toLowerCase()
  if (allowAuto && normalized === 'auto') {
    return normalized
  }

  const match = /^(\d{1,4}(?:\.\d{1,2})?)(px|%)$/.exec(normalized)
  if (!match) {
    return ''
  }

  const amount = Number(match[1])
  if (!Number.isFinite(amount) || amount <= 0 || (match[2] === '%' ? amount > 100 : amount > 4000)) {
    return ''
  }

  return `${amount}${match[2]}`
}

const sanitizeImageStyle = (sourceElement: Element, cleanElement: HTMLElement) => {
  const sourceStyle = (sourceElement as HTMLElement).style
  const width = sanitizeCssSize(sourceStyle.width)
  const height = sanitizeCssSize(sourceStyle.height, true)

  if (width) {
    cleanElement.style.width = width
  }
  if (height) {
    cleanElement.style.height = height
  }

  if (sourceStyle.float === 'left' || sourceStyle.float === 'right') {
    cleanElement.style.float = sourceStyle.float
    cleanElement.style.marginTop = '4px'
    cleanElement.style.marginBottom = '12px'
    cleanElement.style.marginLeft = sourceStyle.float === 'left' ? '0px' : '20px'
    cleanElement.style.marginRight = sourceStyle.float === 'left' ? '20px' : '0px'
    return
  }

  if (sourceStyle.display === 'block' && sourceStyle.marginLeft === 'auto' && sourceStyle.marginRight === 'auto') {
    cleanElement.style.display = 'block'
    cleanElement.style.marginLeft = 'auto'
    cleanElement.style.marginRight = 'auto'
  }
}

const sanitizeTableSpan = (value: string | null) => {
  if (!value || !/^\d{1,3}$/.test(value.trim())) {
    return ''
  }

  const span = Number(value)
  return span >= 1 && span <= 100 ? String(span) : ''
}

const sanitizeTableStyle = (sourceElement: Element, cleanElement: HTMLElement, tagName: string) => {
  const sourceStyle = (sourceElement as HTMLElement).style
  const width = sanitizeCssSize(sourceStyle.width)
  const height = sanitizeCssSize(sourceStyle.height)

  if (width && ['table', 'col', 'th', 'td'].includes(tagName)) {
    cleanElement.style.width = width
  }
  if (height && (tagName === 'th' || tagName === 'td')) {
    cleanElement.style.height = height
  }
  if (tagName === 'table' && (sourceStyle.borderCollapse === 'collapse' || sourceStyle.borderCollapse === 'separate')) {
    cleanElement.style.borderCollapse = sourceStyle.borderCollapse
  }
  if (['caption', 'th', 'td'].includes(tagName) && ['left', 'center', 'right', 'justify'].includes(sourceStyle.textAlign)) {
    cleanElement.style.textAlign = sourceStyle.textAlign
  }
  if ((tagName === 'th' || tagName === 'td') && ['top', 'middle', 'bottom', 'baseline'].includes(sourceStyle.verticalAlign)) {
    cleanElement.style.verticalAlign = sourceStyle.verticalAlign
  }
}

const sanitizeRichTextNode = (node: Node, doc: Document): Node | null => {
  if (node.nodeType === TEXT_NODE) {
    return doc.createTextNode(node.textContent ?? '')
  }

  if (node.nodeType !== ELEMENT_NODE) {
    return null
  }

  const sourceElement = node as Element
  const tagName = sourceElement.tagName.toLowerCase()

  if (blockedRichTextTags.has(tagName)) {
    return null
  }

  const cleanChildren = (parent: Node) => {
    Array.from(sourceElement.childNodes).forEach((child) => {
      const cleanChild = sanitizeRichTextNode(child, doc)
      if (cleanChild) {
        parent.appendChild(cleanChild)
      }
    })
  }

  if (!allowedRichTextTags.has(tagName)) {
    const fragment = doc.createDocumentFragment()
    cleanChildren(fragment)
    return fragment
  }

  const cleanElement = doc.createElement(tagName)

  if (tagName === 'a') {
    const href = sourceElement.getAttribute('href')
    const title = sourceElement.getAttribute('title')
    const target = sourceElement.getAttribute('target')

    if (href && isSafeHref(href)) {
      cleanElement.setAttribute('href', href.trim())
    }
    if (title) {
      cleanElement.setAttribute('title', title)
    }
    if (target === '_blank' || target === '_self') {
      cleanElement.setAttribute('target', target)
    }
    if (target === '_blank') {
      cleanElement.setAttribute('rel', 'noopener noreferrer')
    }
  }

  if (tagName === 'img') {
    const src = sourceElement.getAttribute('src')
    if (!src || !isSafeImageSrc(src)) {
      return null
    }

    const alt = sourceElement.getAttribute('alt')
    const title = sourceElement.getAttribute('title')
    const width = sanitizeDimension(sourceElement.getAttribute('width'))
    const height = sanitizeDimension(sourceElement.getAttribute('height'))

    cleanElement.setAttribute('src', imageSrcToAppPath(src.trim()))
    if (alt) {
      cleanElement.setAttribute('alt', alt)
    }
    if (title) {
      cleanElement.setAttribute('title', title)
    }
    if (width) {
      cleanElement.setAttribute('width', width)
    }
    if (height) {
      cleanElement.setAttribute('height', height)
    }
    sanitizeImageStyle(sourceElement, cleanElement)

    return cleanElement
  }

  if (tagName === 'th' || tagName === 'td') {
    const colspan = sanitizeTableSpan(sourceElement.getAttribute('colspan'))
    const rowspan = sanitizeTableSpan(sourceElement.getAttribute('rowspan'))
    if (colspan) {
      cleanElement.setAttribute('colspan', colspan)
    }
    if (rowspan) {
      cleanElement.setAttribute('rowspan', rowspan)
    }

    const scope = sourceElement.getAttribute('scope')
    if (tagName === 'th' && scope && ['row', 'col', 'rowgroup', 'colgroup'].includes(scope)) {
      cleanElement.setAttribute('scope', scope)
    }
  }

  if (tagName === 'col' || tagName === 'colgroup') {
    const span = sanitizeTableSpan(sourceElement.getAttribute('span'))
    if (span) {
      cleanElement.setAttribute('span', span)
    }
  }

  if (['table', 'caption', 'col', 'th', 'td'].includes(tagName)) {
    sanitizeTableStyle(sourceElement, cleanElement, tagName)
  }

  cleanChildren(cleanElement)
  return cleanElement
}

export const sanitizeRichTextHtml = (value: string) => {
  const source = value.trim()
  if (!source) {
    return ''
  }

  if (!hasHtmlMarkup(source) || typeof DOMParser === 'undefined') {
    return escapeHtml(source).replace(/\r?\n/g, '<br />')
  }

  const doc = new DOMParser().parseFromString(source, 'text/html')
  const output = doc.createElement('div')

  Array.from(doc.body.childNodes).forEach((child) => {
    const cleanChild = sanitizeRichTextNode(child, doc)
    if (cleanChild) {
      output.appendChild(cleanChild)
    }
  })

  return output.innerHTML
}
