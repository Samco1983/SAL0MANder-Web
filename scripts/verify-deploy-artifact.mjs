#!/usr/bin/env node
/**
 * Check that the built artifact is actually servable from its deploy path.
 *
 * Unit tests cannot see any of this. They test source; every failure here is a
 * property of the *output*, and every one of them ships silently:
 *
 *   base stops applying      assets resolve to /assets/... and the site is blank
 *   404 copy step dropped    deep share links stop resolving on Pages
 *   .nojekyll missing        Pages hides underscore-prefixed paths
 *   404.html drifts          a pasted link boots different code than a typed one
 *
 * Pure function first, CLI second, so the checks are testable without running
 * a real build.
 *
 *   node scripts/verify-deploy-artifact.mjs dist /SAL0MANder-Web/
 */

import { readFileSync, existsSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

/** Local references the browser must be able to fetch. Ignores external URLs. */
export function localAssetRefs(html) {
  const refs = []
  // HTML permits double-quoted, single-quoted, and unquoted attribute values.
  // Ignoring the third form lets a broken reference bypass the deploy gate.
  const pattern = /(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi
  let m
  while ((m = pattern.exec(html)) !== null) {
    const ref = m[1] ?? m[2] ?? m[3]
    // Anything with a scheme, protocol-relative, or a fragment is not ours to
    // resolve — prefixing or judging those would break working CDN links.
    if (/^[a-z][a-z0-9+.-]*:/i.test(ref) || ref.startsWith('//') || ref.startsWith('#')) continue
    refs.push(ref)
  }
  return refs
}

export function verifyArtifact(dir, basePath) {
  const problems = []
  const base = basePath.endsWith('/') ? basePath : `${basePath}/`

  const indexPath = join(dir, 'index.html')
  if (!existsSync(indexPath)) {
    // Nothing else is meaningful without it, so this returns early rather than
    // producing a cascade of derived failures that hide the real one.
    return [`${indexPath} does not exist — the build produced no entry point`]
  }
  const index = readFileSync(indexPath, 'utf8')

  for (const ref of localAssetRefs(index)) {
    if (!ref.startsWith('/')) {
      problems.push(
        `index.html uses relative local reference "${ref}" — it resolves differently ` +
          'from deep SPA fallback URLs and must be rooted at the deploy base',
      )
      continue
    }
    if (!ref.startsWith(base)) {
      problems.push(
        `index.html references "${ref}", which is outside the deploy base "${base}" — ` +
          `the browser will request it from the wrong path and the page will render blank`,
      )
      continue
    }

    const pathname = ref.split(/[?#]/, 1)[0]
    let artifactRelativePath
    try {
      artifactRelativePath = decodeURIComponent(pathname.slice(base.length))
    } catch {
      problems.push(`index.html contains malformed URL encoding in local reference "${ref}"`)
      continue
    }

    const artifactPath = resolve(dir, artifactRelativePath || '.')
    const artifactRoot = resolve(dir)
    const pathFromRoot = relative(artifactRoot, artifactPath)
    if (pathFromRoot === '..' || pathFromRoot.startsWith('../') || pathFromRoot.startsWith('/')) {
      problems.push(`index.html local reference "${ref}" escapes the deploy artifact`)
      continue
    }
    if (!existsSync(artifactPath)) {
      problems.push(
        `index.html references "${ref}", but "${artifactPath}" is missing from the deploy artifact`,
      )
    } else if (artifactRelativePath && !statSync(artifactPath).isFile()) {
      problems.push(`index.html references "${ref}", but it does not resolve to a file`)
    }
  }

  const notFound = join(dir, '404.html')
  if (!existsSync(notFound)) {
    problems.push(
      '404.html is missing — Pages has no rewrite, so every deep share link ' +
        '(/play/<id>) 404s on a hard load while still working in-app',
    )
  } else if (readFileSync(notFound, 'utf8') !== index) {
    problems.push(
      '404.html differs from index.html — a pasted link would boot different ' +
        'code than a typed one, which is the hardest class of bug to reproduce',
    )
  }

  const nojekyll = join(dir, '.nojekyll')
  if (!existsSync(nojekyll) || !statSync(nojekyll).isFile()) {
    problems.push(
      '.nojekyll is missing — Pages runs Jekyll and hides any path beginning ' +
        'with an underscore, which is where Unity WebGL output can land',
    )
  }

  return problems
}

const isMain = process.argv[1] && process.argv[1].endsWith('verify-deploy-artifact.mjs')
if (isMain) {
  const dir = process.argv[2] ?? 'dist'
  const base = process.argv[3] ?? process.env.VITE_BASE_PATH ?? '/'
  const problems = verifyArtifact(dir, base)
  if (problems.length === 0) {
    console.log(`  deploy artifact OK — ${dir} is servable from ${base}`)
    process.exit(0)
  }
  console.error(`\n  DEPLOY ARTIFACT NOT SERVABLE from ${base}\n`)
  for (const p of problems) console.error(`    - ${p}`)
  console.error('')
  process.exit(1)
}
