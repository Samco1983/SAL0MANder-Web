#!/usr/bin/env node
/**
 * Print a launchd plist for the SAL0MANder council supervisor.
 *
 * This intentionally does not install, load, or modify launchd. It only renders
 * the plist so the schedule can be reviewed before activation.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const OUT_DIR = join(ROOT, 'docs', 'coordination', 'launchd')
const PLIST_PATH = join(OUT_DIR, 'com.sal0mander.council-supervisor.plist')
const LABEL = 'com.sal0mander.council-supervisor'
const NODE = process.execPath
const SCRIPT = join(ROOT, 'scripts', 'sal0-council-supervisor.mjs')
const LOG_DIR = join(ROOT, 'docs', 'coordination', 'runs', 'logs')
const INTERVAL_SECONDS = Number(process.env.SAL0_COUNCIL_INTERVAL_SECONDS || '3600')

function plistEscape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${plistEscape(LABEL)}</string>

  <key>WorkingDirectory</key>
  <string>${plistEscape(ROOT)}</string>

  <key>ProgramArguments</key>
  <array>
    <string>${plistEscape(NODE)}</string>
    <string>${plistEscape(SCRIPT)}</string>
    <string>--dry-run</string>
  </array>

  <key>StartInterval</key>
  <integer>${INTERVAL_SECONDS}</integer>

  <key>StandardOutPath</key>
  <string>${plistEscape(join(LOG_DIR, 'council-supervisor.out.log'))}</string>

  <key>StandardErrorPath</key>
  <string>${plistEscape(join(LOG_DIR, 'council-supervisor.err.log'))}</string>

  <key>RunAtLoad</key>
  <false/>
</dict>
</plist>
`

mkdirSync(OUT_DIR, { recursive: true })
writeFileSync(PLIST_PATH, plist)
console.log(PLIST_PATH)
