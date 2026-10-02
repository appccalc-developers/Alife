import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const outputDir = resolve(root, 'docs/design/generated')
const entries = [
  ['architecture', '总体架构 / Architecture', 'docs/architecture.md'],
  ['pages', '页面制作与发布 / Pages', 'docs/pages/PAGE-CONTRACT.md'],
  ['identity', '用户认证 / Identity', 'docs/workspaces/IDENTITY.md'],
  ['church', '教会 Workspace', 'docs/workspaces/CHURCH.md'],
  ['group', '小组 Workspace', 'docs/workspaces/GROUP.md'],
  ['personal', '个人 Workspace', 'docs/workspaces/PERSONAL.md'],
  ['management', '教会与小组管理 / Management', 'docs/workspaces/MANAGEMENT.md'],
]
const escape = value => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
function inline(value, sourcePath) {
  return escape(value).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, target) => {
    if (/^[a-z][a-z0-9+.-]*:/i.test(target) && !/^https?:/i.test(target)) return label
    const [file, anchor] = target.split('#')
    const href = /^https?:/i.test(target) ? target : relative(outputDir, resolve(dirname(sourcePath), file)).replaceAll('\\', '/') + (anchor ? `#${anchor}` : '')
    return `<a href="${href}">${label}</a>`
  })
}
function render(source, sourcePath) {
  const lines = source.split(/\r?\n/)
  let html = '', fence = false, code = [], table = false
  for (const line of lines) {
    if (line.startsWith('```')) {
      if (fence) { html += `<pre>${escape(code.join('\n'))}</pre>`; code = [] }
      fence = !fence; continue
    }
    if (fence) { code.push(line); continue }
    if (!line.startsWith('|') && table) { html += '</tbody></table></div>'; table = false }
    if (line.startsWith('|')) {
      if (/^\|[\s:|-]+\|$/.test(line)) continue
      const cells = line.split('|').slice(1, -1).map(cell => inline(cell.trim(), sourcePath))
      if (!table) { html += `<div class="table"><table><thead><tr>${cells.map(cell => `<th>${cell}</th>`).join('')}</tr></thead><tbody>`; table = true }
      else html += `<tr>${cells.map(cell => `<td>${cell}</td>`).join('')}</tr>`
    } else if (/^#{1,6} /.test(line)) {
      const level = line.match(/^#+/)[0].length
      html += `<h${level}>${inline(line.slice(level + 1), sourcePath)}</h${level}>`
    } else if (line.trim()) html += `<p>${inline(line, sourcePath)}</p>`
  }
  if (table) html += '</tbody></table></div>'
  if (fence) throw new Error('Unclosed source fence')
  return html
}
const nav = entries.map(([id, title]) => `<a href="${id}.html">${escape(title)}</a>`).join('')
const style = `*{box-sizing:border-box}body{margin:0;background:#f5f2eb;color:#18332d;font:16px/1.7 system-ui,sans-serif}header,main{max-width:1100px;margin:auto;padding:28px}header{border-bottom:1px solid #cdd9d2}nav{display:flex;flex-wrap:wrap;gap:14px}a{color:#0d4f43}h1{font-size:clamp(28px,4vw,44px);line-height:1.2}h2{margin-top:40px}p{overflow-wrap:anywhere}.notice{padding:16px;background:#e3f0eb;border-left:4px solid #176b5a}.table{overflow:auto}table{border-collapse:collapse;width:100%;background:white}td,th{padding:12px;text-align:left;border:1px solid #d7dfd9;min-width:150px}th{background:#e3f0eb}pre{white-space:pre-wrap;overflow-wrap:anywhere;padding:18px;background:#e8e5dd}code{font-size:.9em}summary{cursor:pointer;font-weight:700;padding:12px}a:focus-visible,summary:focus-visible{outline:3px solid #176b5a;outline-offset:3px}@media(max-width:500px){header,main{padding:18px}}`
mkdirSync(outputDir, { recursive: true })
for (const [id, title, path] of entries) {
  const source = readFileSync(resolve(root, path), 'utf8').replaceAll('\r\n', '\n')
  const hash = createHash('sha256').update(source).digest('hex')
  const html = `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="generator" content="generate-design-presentations.mjs"><meta name="source-sha256" content="${hash}"><title>${escape(title)}</title><style>${style}</style></head><body><header><p>ALIFE · Design orientation</p><nav aria-label="Design domains">${nav}<a href="../../events/EventManagement-About.html">Event</a></nav></header><main><h1>${escape(title)}</h1><p class="notice">方案说明 / Design explanation. This is generated documentation, not a functioning application or proof of delivery. <a href="../../../${path}">Authoritative source</a>. Source references below link to their owning documents.</p><details><summary>说明使用方式 / How to review</summary><p>Review responsibilities, rules and acceptance; compare current implementation with target gaps. Prototype fixtures and product acceptance remain separate evidence.</p></details>${render(source, resolve(root, path))}</main></body></html>\n`
  const output = resolve(outputDir, `${id}.html`)
  if (process.argv.includes('--check')) {
    if (readFileSync(output, 'utf8').replaceAll('\r\n', '\n') !== html) throw new Error(`Stale presentation: ${id}`)
  } else writeFileSync(output, html)
}
console.log(`Design presentations ${process.argv.includes('--check') ? 'checked' : 'generated'}: ${entries.length}`)
