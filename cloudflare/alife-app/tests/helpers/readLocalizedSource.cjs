const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { fileURLToPath } = require('node:url')
const ts = require('typescript')

// Static UI contract tests inspect both component wiring and its real imported
// catalogue. Resolve literal references so moving copy does not weaken the
// existing placement, accessibility, language or geometry assertions.
exports.readLocalizedSource = (url) => {
  const filename = fileURLToPath(url)
  const source = fs.readFileSync(filename, 'utf8').replace(/\r\n/g, '\n')
  const ast = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true)
  const resources = new Map()
  const edits = []
  const unwrap = node => {
    while (node && (ts.isAsExpression(node) || ts.isParenthesizedExpression(node))) node = node.expression
    return node
  }
  for (const statement of ast.statements) {
    if (!ts.isImportDeclaration(statement) || !statement.moduleSpecifier.text.includes('/i18n/')) continue
    const bindings = statement.importClause?.namedBindings
    if (!bindings || !ts.isNamedImports(bindings) || statement.importClause.isTypeOnly) continue
    let resourcePath = path.resolve(path.dirname(filename), statement.moduleSpecifier.text)
    if (!path.extname(resourcePath)) resourcePath += '.ts'
    const catalogue = ts.createSourceFile(resourcePath, fs.readFileSync(resourcePath, 'utf8'), ts.ScriptTarget.Latest, true)
    const declarations = catalogue.statements.filter(ts.isVariableStatement).flatMap(item => [...item.declarationList.declarations])
    const resolved = []
    for (const binding of bindings.elements) {
      if (binding.isTypeOnly) continue
      const name = binding.propertyName?.text ?? binding.name.text
      const declaration = declarations.find(item => item.name.getText(catalogue) === name)
      assert.ok(declaration?.initializer, `Missing catalogue export ${name} in ${resourcePath}`)
      resources.set(binding.name.text, declaration.initializer)
      resolved.push(`const ${binding.name.text} = ${declaration.initializer.getText(catalogue)}`)
    }
    edits.push([statement.getStart(ast), statement.end, resolved.join('\n')])
  }
  const resolve = node => {
    if (ts.isIdentifier(node)) return unwrap(resources.get(node.text))
    if (!ts.isPropertyAccessExpression(node)) return undefined
    const object = unwrap(resolve(node.expression))
    if (!object || !ts.isObjectLiteralExpression(object)) return undefined
    const property = object.properties.find(item => ts.isPropertyAssignment(item) && item.name.getText() === node.name.text)
    assert.ok(property, `Missing catalogue field ${node.getText(ast)} in ${filename}`)
    return unwrap(property.initializer)
  }
  const visit = node => {
    if (ts.isPropertyAccessExpression(node)) {
      const value = resolve(node)
      if (value && ts.isStringLiteralLike(value)) {
        const literal = "'" + value.text.replaceAll('\\', '\\\\').replaceAll("'", "\\'").replaceAll('\n', '\\n').replaceAll('\r', '\\r') + "'"
        edits.push([node.getStart(ast), node.end, literal])
        return
      }
    }
    ts.forEachChild(node, visit)
  }
  for (const statement of ast.statements) if (!ts.isImportDeclaration(statement)) visit(statement)
  let result = source
  for (const [start, end, value] of edits.sort((left, right) => right[0] - left[0])) result = result.slice(0, start) + value + result.slice(end)
  return result
}
