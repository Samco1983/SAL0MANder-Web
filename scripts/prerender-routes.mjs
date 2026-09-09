#!/usr/bin/env node
/**
 * Give every public page a real file, so a crawler gets 200 instead of 404.
 *
 * GitHub Pages cannot rewrite URLs. The SPA fallback copies index.html to
 * 404.html, so a client-side route like /privacy is served the app shell with
 * an HTTP **404** status. A person clicks the link and sees the page; a
 * crawler reads the status and does not index it.
 *
 * Measured on the live site 2026-08-31:
 *
 *     /           200
 *     /about      404
 *     /privacy    404
 *     /terms      404
 *
 * That makes every trust page invisible to the automated classifiers school
 * web filters use — which is the entire reason those pages were written, since
 * sal0mander.com is currently categorised "Unknown". Worse, sitemap.xml
 * promises those URLs, and a sitemap pointing at 404s is a negative signal
 * rather than a neutral one.
 *
 * Writing dist/<route>/index.html makes Pages serve each one as a directory
 * index with 200. The router still owns what renders; this only changes the
 * status code and the fact that the file exists.
 *
 * ## The route list comes from sitemap.xml on purpose
 *
 * Not from a second hardcoded array. The sitemap is the promise made to
 * crawlers, so deriving from it means the two cannot drift: a page added to the
 * sitemap is prerendered automatically, and a page removed stops being. The
 * failure this prevents is the quiet one — adding a URL to the sitemap and
 * forgetting the build step, which reintroduces exactly the 404 above.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const dist = process.argv[2] ?? 'dist'
const shell = join(dist, 'index.html')

if (!existsSync(shell)) {
  console.error(`[prerender] ${shell} not found — run the build first.`)
  process.exit(1)
}

const sitemapPath = join(dist, 'sitemap.xml')
if (!existsSync(sitemapPath)) {
  console.error(`[prerender] ${sitemapPath} not found — nothing declares which pages are public.`)
  process.exit(1)
}

const html = readFileSync(shell, 'utf8')
const sitemap = readFileSync(sitemapPath, 'utf8')

const SITE_ORIGIN = (sitemap.match(/<loc>\s*(https?:\/\/[^/]+)/) ?? [])[1]
if (!SITE_ORIGIN) {
  console.error('[prerender] sitemap.xml has no absolute <loc> to take the site origin from.')
  process.exit(1)
}

const paths = [...sitemap.matchAll(/<loc>\s*https?:\/\/[^/]+(\/[^<\s]*)\s*<\/loc>/g)]
  .map((m) => m[1].replace(/\/$/, ''))
  .filter((p) => p !== '')

if (paths.length === 0) {
  console.error('[prerender] sitemap.xml lists no paths beyond the root. Refusing to no-op silently.')
  process.exit(1)
}

/**
 * A 200 was only half the job.
 *
 * Copying the shell verbatim gave every route the *homepage's* title and no
 * description at all, so a classifier that does not run JavaScript read the
 * same page at five URLs. Identical titles across a domain is a weak signal,
 * and an empty description is nothing to categorise from — which is the
 * opposite of what this script exists to achieve.
 *
 * So each route also gets its own title, description and canonical. The body
 * still renders client-side; this is what a crawler reads before that happens.
 *
 * A page with no entry here still ships; it warns and keeps the shell's title.
 * Prerendering every sitemap URL is the contract, and a build that fails over a
 * missing description would ship no page at all — reintroducing the very 404
 * this script was written to fix.
 */
const META = {
  '/about': {
    title: 'About SAL0MANder — who makes it and why',
    description:
      'SAL0MANder is a free classroom practice tool built by a teacher. Students answer questions to uncover a jigsaw puzzle. No accounts, no sign-in, no ads.',
  },
  '/privacy': {
    title: 'Privacy — what SAL0MANder does not collect',
    description:
      'SAL0MANder asks students for no name, email or password, and creates no student accounts. What is stored, where it is stored, and how to have it removed.',
  },
  '/accessibility': {
    title: 'Accessibility — SAL0MANder learning puzzles',
    description:
      'Accessibility features, known limitations and ways to report a barrier in SAL0MANder classroom puzzles. A formal accessibility audit has not yet been completed.',
  },
  '/districts': {
    title: 'For school districts — technical and data summary',
    description:
      'Domains to allow, student accounts, data stored, network requirements and accessibility for SAL0MANder. Written for school IT administrators and web filter review.',
  },
  '/terms': {
    title: 'Terms of use — SAL0MANder',
    description: 'The terms covering classroom and personal use of SAL0MANder learning puzzles.',
  },
  '/play/act_integer_operations': {
    title: 'Integer operations puzzle — play free',
    description:
      'A free integer operations practice puzzle. Answer questions to uncover the picture. No account needed.',
  },
  '/play/act_one_step_inequalities': {
    title: 'One-step inequalities puzzle — play free',
    description:
      'A free one-step inequalities practice puzzle. Answer questions to uncover the picture. No account needed.',
  },
  '/play/act_linear_equations': {
    title: 'Linear equations puzzle — play free',
    description:
      'A free linear equations practice puzzle. Answer questions to uncover the picture. No account needed.',
  },
}

const escape = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')

/**
 * A page with no entry still ships — it just keeps the shell's title.
 *
 * The first version of this made a missing entry fatal. That was wrong: a
 * failed build ships nothing, which brings back the 404 this whole script
 * exists to prevent. A page existing outranks a page being well described, so
 * the miss is loud and the file is still written.
 */
function withMeta(path) {
  const meta = META[path]
  if (!meta) {
    console.warn(
      `[prerender] ${path} has no META entry — shipping with the homepage's title. ` +
        'Add one so a crawler can tell this page apart.',
    )
    return html
  }

  /*
    Replace in place rather than prepend.
    The shell already carries a description and Open Graph tags for the
    homepage. An earlier version of this inserted a second description beside
    the title, and since the shell's copy appears first in the document a
    crawler kept reading the homepage's text on every route — which is the
    exact problem this was written to fix, still there, now harder to see.
  */
  const swaps = [
    [/<title>[\s\S]*?<\/title>/, `<title>${escape(meta.title)}</title>`],
    [
      /<meta\b[^>]*\bname="description"[^>]*>/,
      `<meta name="description" content="${escape(meta.description)}" />`,
    ],
    // Open Graph, because teachers hand these links to a class in Classroom or
    // a message. Without this every shared page previews as the homepage.
    [
      /<meta\b[^>]*\bproperty="og:title"[^>]*>/,
      `<meta property="og:title" content="${escape(meta.title)}" />`,
    ],
    [
      /<meta\b[^>]*\bproperty="og:description"[^>]*>/,
      `<meta property="og:description" content="${escape(meta.description)}" />`,
    ],
  ]

  let page = html
  for (const [pattern, replacement] of swaps) {
    if (pattern.test(page)) page = page.replace(pattern, replacement)
  }

  const canonical = `<link rel="canonical" href="${SITE_ORIGIN}${path}/" />`
  if (/<link\b[^>]*rel="canonical"[^>]*>/.test(page)) {
    page = page.replace(/<link\b[^>]*rel="canonical"[^>]*>/, canonical)
  } else if (page.includes('</head>')) {
    page = page.replace('</head>', `${canonical}</head>`)
  }

  return page
}

for (const path of paths) {
  const dir = join(dist, path)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.html'), withMeta(path))
  console.log(`[prerender] ${path}/index.html${META[path] ? ` — "${META[path].title}"` : ''}`)
}

console.log(
  `[prerender] ${paths.length} page(s) now resolve with 200, each with its own title and description.`,
)
