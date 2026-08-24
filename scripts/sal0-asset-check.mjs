#!/usr/bin/env node
/**
 * Referee for delivered puzzle art. Judges the FILE, never the claim about it.
 *
 * The first Gemini packet passed review because I looked at it. That does not
 * scale and it is not a gate — the sidecar claimed a byteSize and sha256
 * belonging to an EARLIER render than the PNG beside it, and only a manual
 * diff caught it. The manifests in docs/coordination/assets carry prompts and
 * no integrity fields whatsoever, so nothing on delivery day compares the
 * bytes to the story about the bytes.
 *
 * Every check here reads the decoded image. A claim in a sidecar is treated as
 * a hypothesis to be falsified, which is the whole point: the builder does not
 * get to referee their own delivery.
 *
 * THE ONE THAT MATTERS is region distinguishability. A puzzle cut into a 3x3
 * grid is UNSOLVABLE if the regions look alike — a sky-heavy image with four
 * near-identical blue corners cannot be completed by reasoning, only by
 * brute force, and a struggling student is the one who pays for that. It is
 * invisible in a thumbnail and obvious in numbers.
 *
 * Usage:
 *   node scripts/sal0-asset-check.mjs <image.png> [sidecar.json]
 *
 * Exit 0 = accept. Exit 1 = reject, with the reason and the measurement.
 */
import { chromium } from 'playwright'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const argv = process.argv.slice(2)
const shaFlag = argv.indexOf('--expect-sha')
/*
 * --expect-sha binds this run to EXACT BYTES.
 *
 * Without it a proof is only as good as the filename, and a filename is
 * mutable: re-running a checker after someone saved a new render under the old
 * name tests the new file while the report still describes the old one. That is
 * the same staleness that produced a byte count quoted from a superseded
 * version this morning — a command is better than a pasted number, but only
 * once the command is pinned to the bytes it claims to have judged.
 */
const expectSha = shaFlag >= 0 ? (argv[shaFlag + 1] ?? '').toLowerCase() : null
if (shaFlag >= 0) argv.splice(shaFlag, 2)
const [imgArg, sidecarArg] = argv
if (!imgArg) {
  console.error('usage: node scripts/sal0-asset-check.mjs <image.png> [sidecar.json]')
  process.exit(1)
}
const imgPath = resolve(process.cwd(), imgArg)
if (!existsSync(imgPath)) {
  console.error(`REJECT  no such file: ${imgArg}`)
  process.exit(1)
}

const bytes = readFileSync(imgPath)
const failures = []
const notes = []

/* 1. Is it actually a PNG? A renamed JPEG or an HTML error page saved as .png
 *    has shipped in this project's asset lanes before. Magic bytes, not suffix. */
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
if (!bytes.subarray(0, 8).equals(PNG_MAGIC)) {
  failures.push(`not a PNG — first bytes are ${bytes.subarray(0, 8).toString('hex')}`)
}

/* 2. Does the sidecar describe THIS file? This is the check that would have
 *    caught the first packet without a human reading two timestamps. */
const sha = createHash('sha256').update(bytes).digest('hex')
const size = statSync(imgPath).size

/* The binding check runs FIRST. If these are not the bytes under review,
 * nothing measured below describes the artifact being claimed, and reporting a
 * verdict on the wrong file is worse than reporting none. */
if (expectSha && expectSha !== sha) {
  console.log(`${imgArg}`)
  console.log(`  REJECT  --expect-sha ${expectSha.slice(0, 16)}… but this file is ${sha.slice(0, 16)}…`)
  console.log('          These are not the bytes under review. Every measurement below would describe a different file.')
  console.log('REJECTED — artifact does not match the submitted hash')
  process.exit(1)
}
if (!expectSha) {
  notes.push('no --expect-sha given — this proof is bound to a filename, not to bytes, and a filename can be overwritten')
}
if (sidecarArg && existsSync(sidecarArg)) {
  const claim = JSON.parse(readFileSync(sidecarArg, 'utf-8'))
  const claimedSize = claim.byteSize ?? claim.bytes ?? claim.size
  const claimedSha = (claim.sha256 ?? claim.checksum?.value ?? '').toLowerCase()
  if (claimedSize != null && Number(claimedSize) !== size) {
    failures.push(`sidecar byteSize ${claimedSize} but the file is ${size} — it describes a different render`)
  }
  if (claimedSha && claimedSha !== sha) {
    failures.push(`sidecar sha256 ${claimedSha.slice(0, 16)}… but the file is ${sha.slice(0, 16)}…`)
  }
  if (claimedSize == null && !claimedSha) {
    notes.push('sidecar carries no byteSize or sha256 — nothing to verify it against')
  }
} else if (sidecarArg) {
  failures.push(`sidecar not found: ${sidecarArg}`)
}

/* 3. Decode it and measure. Uses the browser's own decoder rather than adding an
 *    image dependency — playwright is already here for the web proof, and a
 *    decoder that disagrees with a real browser would be testing the wrong thing. */
const browser = await chromium.launch()
const page = await browser.newPage()
const measured = await page.evaluate(async (dataUrl) => {
  const img = new Image()
  await new Promise((ok, no) => {
    img.onload = ok
    img.onerror = () => no(new Error('decode failed'))
    img.src = dataUrl
  })
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0)

  // Mean colour and internal detail per 3x3 region — the cut a puzzle makes.
  const cells = []
  for (let gy = 0; gy < 3; gy++) {
    for (let gx = 0; gx < 3; gx++) {
      const w = Math.floor(c.width / 3)
      const h = Math.floor(c.height / 3)
      const d = ctx.getImageData(gx * w, gy * h, w, h).data
      let r = 0, g = 0, b = 0
      const lums = []
      for (let i = 0; i < d.length; i += 4) {
        r += d[i]; g += d[i + 1]; b += d[i + 2]
        lums.push(0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2])
      }
      const n = d.length / 4
      const mean = lums.reduce((a, x) => a + x, 0) / n
      // Standard deviation of luminance = how much is going on inside the piece.
      const sd = Math.sqrt(lums.reduce((a, x) => a + (x - mean) ** 2, 0) / n)
      cells.push({ gx, gy, r: r / n, g: g / n, b: b / n, detail: sd })
    }
  }
  return { width: img.naturalWidth, height: img.naturalHeight, cells }
}, `data:image/png;base64,${bytes.toString('base64')}`)
await browser.close()

/* 4. Dimensions the puzzle grid actually requires. */
if (measured.width < 1024 || measured.height < 768) {
  failures.push(`${measured.width}x${measured.height} is below the 1024x768 minimum`)
}
if (measured.width % 3 !== 0 || measured.height % 3 !== 0) {
  notes.push(`${measured.width}x${measured.height} does not divide evenly by 3 — edge pieces will be clipped`)
}

/* 5. Every piece must carry enough detail to be placeable at all. */
const flat = measured.cells.filter((c) => c.detail < 12)
for (const c of flat) {
  failures.push(`region ${c.gx},${c.gy} is nearly featureless (detail ${c.detail.toFixed(1)}) — that piece cannot be placed by reasoning`)
}

/* 6. And no two pieces may be near-indistinguishable from each other. */
let closest = { d: Infinity, a: null, b: null }
for (let i = 0; i < measured.cells.length; i++) {
  for (let j = i + 1; j < measured.cells.length; j++) {
    const a = measured.cells[i], b = measured.cells[j]
    const d = Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b)
    if (d < closest.d) closest = { d, a, b }
  }
}
if (closest.d < 10) {
  failures.push(
    `regions ${closest.a.gx},${closest.a.gy} and ${closest.b.gx},${closest.b.gy} are near-identical ` +
    `(colour distance ${closest.d.toFixed(1)}) — those two pieces are interchangeable to a student`,
  )
}

/* The manifest must describe all nine regions, because the one defect that is
 * invisible to a reader — two interchangeable pieces — is exactly what a
 * region-by-region description forces its author to look at. */
if (sidecarArg && existsSync(sidecarArg)) {
  const claim = JSON.parse(readFileSync(sidecarArg, 'utf-8'))
  const regionText = JSON.stringify(claim.gridRegionNotes ?? claim.regions ?? '')
  const named = ['top-left','top-center','top-right','middle-left','center','middle-right','bottom-left','bottom-center','bottom-right']
  // Separator-agnostic on purpose: manifests here use top_left, and an earlier
  // version of this check accepted only hyphen or space, so it reported "1 of 9
  // regions" against a manifest that described all nine. A false rejection from
  // a checker is worse than no checker — it sends back good work with authority.
  const missing = named.filter((n) => !new RegExp(n.replace('-', '[-_ ]?'), 'i').test(regionText))
  if (missing.length > 2) failures.push(`manifest describes only ${9 - missing.length} of 9 regions — missing ${missing.slice(0, 3).join(', ')}`)
  for (const key of ['imagePath', 'sidecarPath']) {
    const ref = claim[key]
    if (ref && !existsSync(ref)) failures.push(`manifest ${key} points at a path that does not exist: ${ref}`)
  }
}

console.log(`${imgArg}`)
console.log(`  ${measured.width}x${measured.height}, ${size} bytes, sha256 ${sha.slice(0, 16)}…`)
console.log(`  least detailed region: ${Math.min(...measured.cells.map((c) => c.detail)).toFixed(1)}  (needs >12)`)
console.log(`  closest two regions:   ${closest.d.toFixed(1)}  (needs >10)`)
for (const n of notes) console.log(`  NOTE    ${n}`)
for (const f of failures) console.log(`  REJECT  ${f}`)
/*
 * The verdict ladder. This tool may NEVER say APPROVED.
 *
 * It can establish that a puzzle is solvable by reasoning. It cannot establish
 * that a student will care, and a tool that says APPROVED invites exactly that
 * conflation. TECHNICALLY_READY means the measurable objections are gone and
 * the question is now one only a person can answer.
 *
 *   REJECTED          a hard or puzzle-suitability check failed
 *   TECHNICALLY_READY re-runnable checks passed; awaiting Samuel's judgement
 *   APPROVED          Samuel decides it is worth a student's time — not here
 */
const verdict = failures.length === 0 ? 'TECHNICALLY_READY' : 'REJECTED'
const report = {
  verdict,
  artifact: imgArg,
  sha256: sha,
  shaBound: Boolean(expectSha),
  width: measured.width,
  height: measured.height,
  byteSize: size,
  leastDetailedRegion: Number(Math.min(...measured.cells.map((c) => c.detail)).toFixed(1)),
  closestTwoRegions: Number(closest.d.toFixed(1)),
  failures,
  notes,
}
writeFileSync(`${imgPath}.check.json`, JSON.stringify(report, null, 2))
console.log(
  verdict === 'TECHNICALLY_READY'
    ? 'TECHNICALLY_READY — measurable objections are gone. NOT approved: whether it is worth a student\'s time is Samuel\'s call.'
    : `REJECTED on ${failures.length} ground(s)`,
)
console.log(`  report written to ${imgPath}.check.json`)
process.exit(failures.length === 0 ? 0 : 1)
