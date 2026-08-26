import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const sourceRoot = path.resolve(import.meta.dirname, '../src')
const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx'])
const blockingDialogPattern = /(?<![\w$.])(?:alert|confirm|prompt)\s*\(|\b(?:window|globalThis|self)\s*(?:\.\s*(?:alert|confirm|prompt)|\[\s*['"](?:alert|confirm|prompt)['"]\s*\])\s*\(/g

const sourceFiles = async (directory: string): Promise<string[]> => {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(entryPath)
    return sourceExtensions.has(path.extname(entry.name)) ? [entryPath] : []
  }))
  return files.flat()
}

test('frontend source does not use blocking Web API dialogs', async () => {
  const violations: string[] = []

  for (const filename of await sourceFiles(sourceRoot)) {
    const source = await readFile(filename, 'utf8')
    const matches = source.match(blockingDialogPattern)
    if (matches?.length) {
      violations.push(`${path.relative(sourceRoot, filename)}: ${matches.join(', ')}`)
    }
  }

  assert.deepEqual(violations, [], `Use an application-rendered Alife modal instead:\n${violations.join('\n')}`)
})
