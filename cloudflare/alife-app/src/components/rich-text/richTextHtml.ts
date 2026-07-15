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

export const richTextBodyClass = [
  'flow-root min-w-0 break-words',
  '[&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-2',
  '[&_blockquote]:my-5 [&_blockquote]:border-l-4 [&_blockquote]:border-emerald-500 [&_blockquote]:pl-4',
  '[&_h2]:mb-3 [&_h2]:mt-6 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:leading-tight',
  '[&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-xl [&_h3]:font-bold [&_h3]:leading-tight',
  '[&_h4]:mb-2 [&_h4]:mt-4 [&_h4]:text-lg [&_h4]:font-bold [&_h4]:leading-tight',
  '[&_hr]:my-6 [&_hr]:border-slate-200',
  '[&_img]:my-5 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-slate-200',
  '[&_li]:my-1',
  '[&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-6',
  '[&_p]:mb-4 [&_p:last-child]:mb-0',
  '[&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-6',
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
      url.hostname === 'images.ccalc.live'
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

const sanitizeImageCssSize = (value: string, allowAuto = false) => {
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
  const width = sanitizeImageCssSize(sourceStyle.width)
  const height = sanitizeImageCssSize(sourceStyle.height, true)

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
