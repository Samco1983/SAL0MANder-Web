import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

/** Verify the player bytes accepted in the browser, before and after publication. */
export function playerRootFromSite(site) {
  return new URL('unity/', site.replace(/\/?$/, '/')).href
}

export async function verifyPlayer(root, manifest, fetcher = fetch) {
  assert.equal(manifest.schemaVersion, 1, 'Unsupported player manifest')
  assert.equal(manifest.compression, 'none', 'Release expects uncompressed player inputs')
  assert.match(manifest.buildName, /^[a-zA-Z0-9_-]+$/)
  if (manifest.acceptedUnityBuildId) {
    const sourceFiles = [...manifest.files, ...(manifest.standaloneSourcePage ? [manifest.standaloneSourcePage] : [])]
      .map(row => ({ file: row.path, bytes: row.bytes, sha256: row.sha256 }))
      .sort((a, b) => a.file.localeCompare(b.file))
    assert.equal('sha256:' + createHash('sha256').update(JSON.stringify(sourceFiles)).digest('hex'), manifest.acceptedUnityBuildId, 'Accepted source player identity differs')
  }
  const entries = new Set()
  const remote = /^https:\/\//.test(root)
  for (const row of manifest.files) {
    assert.match(row.path, /^[^\\:]+$/, 'Use a relative POSIX player path')
    assert(!row.path.startsWith('/') && row.path.split('/').every(p => p && p !== '.' && p !== '..'), 'Unsafe player path')
    assert(!entries.has(row.path), 'Duplicate player path')
    entries.add(row.path)
    let bytes
    if (remote) {
      const url = new URL(row.path, root.replace(/\/?$/, '/'))
      if (row.path.startsWith('Build/')) url.searchParams.set('v', manifest.release)
      const response = await fetcher(url, { cache: 'no-store', signal: AbortSignal.timeout(60000) })
      assert.equal(response.status, 200, `${row.path}: HTTP status`)
      bytes = Buffer.from(await response.arrayBuffer())
    } else {
      bytes = await readFile(path.resolve(root, row.path))
    }
    assert.equal(bytes.length, row.bytes, `${row.path}: byte count differs from accepted player`)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), row.sha256, `${row.path}: accepted player hash differs`)
  }
  for (const ext of ['loader.js', 'data', 'framework.js', 'wasm']) {
    assert(entries.has(`Build/${manifest.buildName}.${ext}`), `Required player file missing: ${ext}`)
  }
  return entries.size
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = process.argv.includes('--site-root') ? playerRootFromSite(process.argv[2]) : process.argv[2]
  assert(root, 'Usage: node scripts/verify-player-manifest.mjs <player-directory-or-HTTPS-URL>')
  const manifest = JSON.parse(await readFile(new URL('../release/player-manifest.json', import.meta.url), 'utf8'))
  const count = await verifyPlayer(root, manifest)
  process.stdout.write(`Accepted player verified: ${count} files; ${manifest.acceptedUnityBuildId}\n`)
}
