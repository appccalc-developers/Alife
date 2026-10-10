const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const ts = require('typescript')

const sourceRoot = path.resolve(__dirname, '../src')
const resourceRoot = path.join(sourceRoot, 'i18n')
const chinese = /[\u3400-\u9fff]/

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(filename) : /\.tsx?$/.test(entry.name) ? [filename] : []
  })
}

function parse(filename) {
  return ts.createSourceFile(filename, fs.readFileSync(filename, 'utf8'), ts.ScriptTarget.Latest, true)
}

function property(object, name) {
  return object.properties.find(item => ts.isPropertyAssignment(item) && item.name.text === name)
}

function violations(source) {
  const issues = []
  function visit(node) {
    if (ts.isObjectLiteralExpression(node)) {
      const en = property(node, 'en')?.initializer
      const zh = property(node, 'zh')?.initializer
      if (en && zh && ts.isStringLiteralLike(en) && ts.isStringLiteralLike(zh)
          && (en.text || zh.text) && !(en.text === 'TODO' && zh.text === 'TODO')) {
        issues.push(node.getStart(source))
      }
    }
    if (ts.isStringLiteralLike(node) && chinese.test(node.text)) {
      const parent = node.parent
      // Content identifiers and string matching are domain values, not display copy.
      const propertyName = ts.isPropertyAssignment(parent) && parent.name === node
      const typeLiteral = ts.isLiteralTypeNode(parent)
      const textMatch = ts.isCallExpression(parent) && ts.isPropertyAccessExpression(parent.expression)
        && ['includes', 'startsWith', 'endsWith'].includes(parent.expression.name.text)
      const contactName = source.fileName.replaceAll('\\', '/').endsWith('/utils/contactLocation.ts')
        && ts.isVariableDeclaration(parent) && parent.name.text === 'defaultLocationInquiryContactName'
      if (!propertyName && !typeLiteral && !textMatch && !contactName) issues.push(node.getStart(source))
    }
    if (ts.isTemplateExpression(node)
        && chinese.test(node.head.text + node.templateSpans.map(span => span.literal.text).join(''))) {
      issues.push(node.getStart(source))
    }
    if (ts.isJsxText(node) && chinese.test(node.text)) issues.push(node.getStart(source))
    ts.forEachChild(node, visit)
  }
  visit(source)
  return [...new Set(issues)]
}

test('fixed bilingual display copy lives in i18n; empty and user-authored payloads remain valid', () => {
  const failures = sourceFiles(sourceRoot).filter(filename => !filename.startsWith(resourceRoot + path.sep))
    .flatMap(filename => {
      const source = parse(filename)
      return violations(source).map(position => `${path.relative(sourceRoot, filename)}:${source.getLineAndCharacterOfPosition(position).line + 1}`)
    })
  assert.deepEqual(failures, [])
})

test('the copy guard recognizes inline labels, helper arguments and interpolated labels', () => {
  const source = ts.createSourceFile('example.tsx', [
    "const label = { en: 'Location', zh: '地点' }",
    "const action = zh ? '保存' : 'Save'",
    "const hint = localize('Please enter a name', '请填写名称')",
    'const count = zh ? `共 ${total} 人` : `${total} people`',
    'const raw = <div>保存</div>',
  ].join('\n'), ts.ScriptTarget.Latest, true)
  assert.ok(violations(source).length >= 5)
  const payload = ts.createSourceFile('payload.ts', `const empty = { en: '', zh: '' }; const user = { en: input.en, zh: input.zh }`, ts.ScriptTarget.Latest, true)
  assert.deepEqual(violations(payload), [])
})

test('English and Chinese object catalogues expose the same field names', () => {
  const failures = []
  for (const filename of sourceFiles(resourceRoot)) {
    const source = parse(filename)
    function visit(node) {
      if (ts.isObjectLiteralExpression(node)) {
        const en = property(node, 'en')?.initializer
        const zh = property(node, 'zh')?.initializer
        if (en && zh && ts.isObjectLiteralExpression(en) && ts.isObjectLiteralExpression(zh)) {
          const keys = value => value.properties.map(item => item.name?.text).sort()
          if (JSON.stringify(keys(en)) !== JSON.stringify(keys(zh))) failures.push(path.basename(filename))
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(source)
  }
  assert.deepEqual(failures, [])
})
