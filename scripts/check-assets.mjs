import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

const fonts = await readdir('dist/fonts')
const fontBytes = (await Promise.all(fonts.filter(name => name.endsWith('.woff2')).map(name => readFile(`dist/fonts/${name}`)))).reduce((sum, data) => sum + data.length, 0)
const assets = await readdir('dist/assets')
let compressedBytes = 0, rawBytes = 0
for (const name of assets.filter(name => /\.(js|css)$/.test(name))) {
    const data = await readFile(`dist/assets/${name}`)
    compressedBytes += gzipSync(data).length; rawBytes += data.length
}
for (const name of ['characters', 'spire', 'battle', 'cards']) {
    const bytes = (await readFile(`dist/art/${name}.webp`)).length
    compressedBytes += bytes; rawBytes += bytes
}
compressedBytes += fontBytes; rawBytes += fontBytes
assert.equal(fonts.filter(name => name.endsWith('.woff2')).length, 3, 'All three local font faces must ship')
assert(fontBytes <= 130_000, `Font budget exceeded: ${fontBytes}`)
assert(compressedBytes <= 2_000_000, `Compressed asset budget exceeded: ${compressedBytes}`)
assert(rawBytes <= 3_200_000, `Uncompressed asset budget exceeded: ${rawBytes}`)
console.log('Built asset size budgets passed.')
