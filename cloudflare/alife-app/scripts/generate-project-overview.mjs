import { copyFile, mkdir } from 'node:fs/promises'

// README.html is the only maintained copy. Resolve from this script so callers
// can generate the public page from any working directory.
const source = new URL('../../../README.html', import.meta.url)
const destinationDirectory = new URL('../public/project/', import.meta.url)
const destination = new URL('index.html', destinationDirectory)

await mkdir(destinationDirectory, { recursive: true })
await copyFile(source, destination)
console.log('Generated public/project/index.html from the root README.html')
