import { env } from '@config/env'
import { paths, buildPath } from '@config/routes'
import { MOCK_DEMO_ACTIVITIES } from '@api/mockTransport'
import { PUZZLE_LIBRARY } from '@content/puzzleLibrary'
import { AppShell } from '@components/layout/AppShell'
import { SharePanel } from '@components/share/SharePanel'
import { LinkButton } from '@components/ui/Button'
import { Card } from '@components/ui/Card'
import { Link } from 'react-router-dom'
import styles from './HomePage.module.css'

/**
 * The public front door — and the page a web filter's reviewer reads.
 *
 * A district blocks sal0mander.com as "categorized as Unknown". Securly and
 * Cisco both describe their reviewers examining page text and structure, so
 * what this page *says* is part of the categorization input, not only the meta
 * tags a crawler parses.
 *
 * Until now it said "Cloud companion platform", "The SAL0MANder application
 * owns the gameplay. This site is the cloud companion around it", "Mock
 * backend", "Contract version v1 · Draft", and "What the web platform is
 * responsible for". All accurate to an engineer and all wrong for the audience:
 * it reads as internal architecture documentation, and "Mock backend" and
 * "Draft" say *unfinished* to anyone deciding whether this is a real product.
 *
 * Rewritten for the two people who actually arrive here — a teacher deciding in
 * about four seconds, and a reviewer deciding what this domain is.
 *
 * ## Every claim on this page is one the repository can defend
 *
 * No COPPA, FERPA, WCAG, or standards-alignment claim appears, because nothing
 * here establishes one. The numbers are checkable: zero student accounts
 * (`src/auth/guestIdentity.ts`), zero ad and analytics scripts (nothing in
 * `index.html` but the app's own module), one domain (the bundle contacts no
 * external host). A page that overstates is the thing a district checks first.
 */
/**
 * The hero picture, and the nine cells drawn over it.
 *
 * The page explained the mechanic in three places and showed it in none: the
 * gallery further down proves the pictures are good, but a teacher has to read
 * a paragraph to learn that answering a question is what uncovers one. This is
 * that sentence, drawn.
 *
 * Chosen BY KEY, never by array position — `puzzleLibrary.ts` makes exactly
 * this point about `imagePresetIndex`, and a hero that silently repoints at a
 * different picture when someone reorders the library is the same bug on a more
 * visible surface.
 *
 * Nine cells because the three launch activities are nine pieces on a square
 * board (`DEMO_PIECE_COUNT`), so the illustration matches what a teacher gets
 * when they follow the button beside it rather than flattering it.
 */
const HERO_PICTURE = PUZZLE_LIBRARY.find((p) => p.key === 'salamander-forest')
/** Still to be earned. Scattered rather than contiguous: a solved-so-far board
    does not fill in reading order, and a neat block reads as a loading state. */
const HERO_COVERED = new Set([0, 5, 6, 8])

/** Original, decorative line icons; the adjacent link text names each action. */
function StartIcon({ kind }: { kind: 'mystery' | 'gift' | 'open' | 'studio' | 'pictures' }) {
  return (
    <svg className={styles.startIcon} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      {kind === 'mystery' ? (
        <>
          <rect x="3" y="3" width="42" height="42" rx="5" className={styles.iconBoard} />
          <path d="M5 39 18 22l9 11 8-9 8 15Z" fill="currentColor" opacity="0.6" />
          <circle cx="32" cy="13" r="5" fill="currentColor" />
          <path
            d="M3 3h14v14H3ZM31 17h14v14H31ZM3 31h14v14H3ZM31 31h14v14H31Z"
            className={styles.iconCovered}
          />
          <path d="M17 3v42M31 3v42M3 17h42M3 31h42" stroke="currentColor" strokeWidth="1.5" />
        </>
      ) : (
        <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          {kind === 'gift' && (
            <>
              <path d="M7 20h34v9H7ZM10 29v14h28V29M24 20v23" />
              <path d="M24 20C5 20 10 4 18 10c4 3 6 10 6 10Zm0 0C43 20 38 4 30 10c-4 3-6 10-6 10Z" />
            </>
          )}
          {kind === 'open' && (
            <>
              <path d="m5 19 19-13 19 13v24H5ZM5 19l19 14 19-14M5 43l14-14m24 14L29 29" />
            </>
          )}
          {kind === 'studio' && (
            <>
              <path d="M8 6h25v36H8ZM14 14h12M14 21h8M14 34h12m2-9 10-10 5 5-10 10-7 2Z" />
            </>
          )}
          {kind === 'pictures' && (
            <>
              <rect x="5" y="5" width="38" height="38" rx="4" />
              <circle cx="16" cy="16" r="4" />
              <path d="m7 37 11-12 7 7 7-13 9 18" />
            </>
          )}
        </g>
      )}
    </svg>
  )
}

export function HomePage() {
  return (
    <AppShell>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>{env.appName} · Learning puzzles for the classroom</p>
          <h1 className={styles.title}>
            Mystery Pictures<span>Answer. Reveal a picture.</span>
          </h1>
          <p className={styles.lede}>
            Make math, science, and vocabulary practice visual. Each correct answer uncovers more of
            the picture automatically. No student account needed.
          </p>
        </div>

        <nav className={styles.startChoices} aria-label="Start here">
          <Link
            to={buildPath.guestPlay(MOCK_DEMO_ACTIVITIES[0].id)}
            className={`${styles.startTile} ${styles.mysteryTile}`}
            aria-labelledby="start-mystery-title start-demo-action"
            aria-describedby="start-mystery-description"
          >
            <StartIcon kind="mystery" />
            <span className={styles.startText}>
              <strong id="start-mystery-title">Mystery Pictures</strong>
              <span id="start-mystery-description">
                In the demo, choose Mystery Reveal for automatic picture reveals.
              </span>
              <span className={styles.startAction} id="start-demo-action">
                Play a demo <span aria-hidden="true">→</span>
              </span>
            </span>
          </Link>
          <Link
            to={paths.gifts}
            className={styles.startTile}
            aria-labelledby="start-gift-title"
            aria-describedby="start-gift-description"
          >
            <StartIcon kind="gift" />
            <span className={styles.startText}>
              <strong id="start-gift-title">Make a Puzzle Gift</strong>
              <span id="start-gift-description">Choose a picture and a way to play.</span>
            </span>
          </Link>
          <Link
            to={paths.giftPlay}
            className={styles.startTile}
            aria-labelledby="start-open-title"
            aria-describedby="start-open-description"
          >
            <StartIcon kind="open" />
            <span className={styles.startText}>
              <strong id="start-open-title">Open a gift</strong>
              <span id="start-open-description">Paste a complete gift link or backup code.</span>
            </span>
          </Link>
          <Link
            to={paths.studio}
            className={styles.startTile}
            aria-labelledby="start-studio-title"
            aria-describedby="start-studio-description"
          >
            <StartIcon kind="studio" />
            <span className={styles.startText}>
              <strong id="start-studio-title">Teacher Studio</strong>
              <span id="start-studio-description">Create and preview your own activity.</span>
            </span>
          </Link>
          <a
            href="#pictures-title"
            className={styles.startTile}
            aria-labelledby="start-pictures-title"
            aria-describedby="start-pictures-description"
          >
            <StartIcon kind="pictures" />
            <span className={styles.startText}>
              <strong id="start-pictures-title">Picture library</strong>
              <span id="start-pictures-description">Find a picture worth uncovering.</span>
            </span>
          </a>
        </nav>

        {/*
          Three numbers a teacher and a district reviewer both care about, and
          all three are checkable in this repository rather than asserted.

          They replaced "Demo activity: 1 / Mock backend" and "Contract
          version: v1 / Draft" — internal status dressed as product facts, and
          the two words most likely to make a reviewer file this as unfinished.

          Term before definition, and the visual order flipped in CSS instead.
          A screen reader announces "Demo activity: 1", which is the sentence a
          person would say; the value-first version I wrote initially was both
          invalid markup and announced backwards as "1, Demo activity".
        */}
        {/*
          Deliberately NOT lazy and NOT below the fold: this is the largest
          element painted on first load, and `loading="lazy"` on an LCP image
          delays the very thing it is meant to speed up. The gallery below stays
          lazy, which is where that attribute earns its keep.

          Its alt text describes the demonstration rather than reusing the
          library's description of the scene — the same file is doing a
          different job here, and two identical alt strings on one page would
          also make "shows every picture in the library" ambiguous.
        */}
        {HERO_PICTURE ? (
          <figure className={styles.heroArt}>
            <div className={styles.heroArtFrame}>
              <img
                className={styles.heroArtImage}
                src={HERO_PICTURE.src}
                alt="A forest guardian puzzle part-way through: five of its nine pieces uncovered, four still hidden."
                width={HERO_PICTURE.width}
                height={HERO_PICTURE.height}
                decoding="async"
              />
              {/*
                Decorative: the figcaption below says the same thing in words,
                and a screen reader announcing nine empty spans would be noise.
              */}
              <div className={styles.heroArtGrid} aria-hidden="true">
                {Array.from({ length: 9 }, (_, i) => (
                  <span
                    key={i}
                    className={styles.heroArtCell}
                    data-covered={HERO_COVERED.has(i) ? 'true' : undefined}
                  />
                ))}
              </div>
            </div>
            <figcaption className={styles.heroArtCaption}>
              A little more wonder with every answer.
            </figcaption>
          </figure>
        ) : null}

        <dl className={styles.stats}>
          {[
            { label: 'Student accounts', value: 'None needed' },
            { label: 'Ads and tracking scripts', value: 'None' },
            { label: 'Classroom setup', value: 'Share one link' },
          ].map((s) => (
            <div className={styles.stat} key={s.label}>
              <dt className={styles.statLabel}>{s.label}</dt>
              <dd className={styles.statValue}>{s.value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.section} aria-labelledby="play-styles-title">
        <h2 className={styles.sectionTitle} id="play-styles-title">
          Choose how to play
        </h2>
        <div className={styles.modeChoices}>
          <Card title="Mystery Pictures">
            Answer a question and watch part of the picture appear automatically. Choose
            <strong> Mystery Reveal</strong> in the demo.
            <div className={styles.cardAction}>
              <LinkButton to={buildPath.guestPlay(MOCK_DEMO_ACTIVITIES[0].id)}>
                Open demo options
              </LinkButton>
            </div>
          </Card>
          <Card title="Learning Puzzle">
            Answer questions to earn pieces, then drag and place them yourself.
            <div className={styles.cardAction}>
              <LinkButton to={buildPath.guestPlay(MOCK_DEMO_ACTIVITIES[0].id)}>
                Open demo options
              </LinkButton>
            </div>
          </Card>
          <Card title="Classic Jigsaw">
            Put the picture together with every piece available and no questions. Choose Classic in
            the demo.
            <div className={styles.cardAction}>
              <LinkButton to={buildPath.guestPlay(MOCK_DEMO_ACTIVITIES[0].id)}>
                Open demo options
              </LinkButton>
            </div>
          </Card>
          <Card title="Slide & Solve">
            Shift whole rows and columns to rebuild the picture. Choose Slide &amp; Solve in the
            gift maker.
            <div className={styles.cardAction}>
              <LinkButton to={paths.gifts}>Open gift maker</LinkButton>
            </div>
          </Card>
        </div>
      </section>

      {/*
        The three activities, rendered FROM `MOCK_DEMO_ACTIVITIES` rather than
        written out here.

        Not a style preference. Two separate drafts of this work named the
        activity ids wrong, in two different ways — `act_integer_ops` in one and
        the old seeded set (`act_quadratics`, `act_cell_structure`,
        `act_vocab_review`) in another — and neither mistake failed anything,
        because a hardcoded string on a page is not checked against anything.
        Mapping the array means the ids here cannot drift from the ids the
        transport resolves, and `threeDemoActivities.test.ts` pins those to
        Unity's.

        A wrong id is not a cosmetic bug on this page: it is a dead share link
        on a teacher's printed worksheet.
      */}
      <section className={styles.section} aria-labelledby="activities-title">
        <h2 className={styles.sectionTitle} id="activities-title">
          Activities you can try right now
        </h2>
        <p className={styles.demoShareText}>
          Pick a lesson and start playing. No account or installation needed.
        </p>
        <p className={styles.demoShareText}>
          Start with <strong>Mystery Pictures</strong>: choose <strong>Mystery Reveal</strong> in a
          lesson to have each earned piece appear automatically. Choose{' '}
          <strong>Learning Puzzle</strong> to answer questions, then drag and place each earned
          piece yourself. Both uncover the picture one piece at a time.
        </p>
        <div className={styles.grid}>
          {MOCK_DEMO_ACTIVITIES.map((activity) => (
            <Card key={activity.id} title={activity.title}>
              {activity.description}
              <div className={styles.cardAction}>
                <LinkButton to={buildPath.guestPlay(activity.id)}>Open {activity.title}</LinkButton>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className={styles.section} aria-labelledby="demo-share-title">
        <div className={styles.demoShare}>
          <div className={styles.demoShareCopy}>
            <p className={styles.eyebrow}>For teachers</p>
            <h2 className={styles.sectionTitle} id="demo-share-title">
              One link is the whole setup
            </h2>
            <p className={styles.demoShareText}>
              Copy the link into Google Classroom, Canvas, Schoology, or Teams — or print the QR
              code onto a worksheet. Students open it and start. There is nothing to install and no
              roster to upload.
            </p>
            <div className={styles.inlineActions}>
              <LinkButton to={buildPath.guestPlay(MOCK_DEMO_ACTIVITIES[0].id)} variant="secondary">
                See what a student sees
              </LinkButton>
            </div>
          </div>
          <SharePanel
            activityId={MOCK_DEMO_ACTIVITIES[0].id}
            baseUrl={env.publicBaseUrl}
            title={MOCK_DEMO_ACTIVITIES[0].title}
          />
        </div>
      </section>

      {/*
        The page described the mechanic in words and showed none of it.

        A teacher decides in about four seconds and reads a picture faster than
        a paragraph. A filter's classifier gets six sentences of descriptive alt
        text — coral reefs, the Colosseum, astrophotography — which is a
        stronger Education signal than prose alone on a domain currently
        categorised "Unknown".

        Deliberately NOT captioned as belonging to any activity: Unity owns
        which picture an activity uses. See the note in `puzzleLibrary.ts`.

        Every image is same-origin, lazy below the fold, and carries explicit
        dimensions so the grid reserves its space and the page does not jump as
        they arrive.
      */}
      <section className={styles.section} aria-labelledby="pictures-title">
        <h2 className={styles.sectionTitle} id="pictures-title" tabIndex={-1}>
          The pictures students uncover
        </h2>
        <p className={styles.demoShareText}>
          Every activity is built on a picture, revealed a piece at a time as students answer. A
          sample of the library:
        </p>
        <ul className={styles.gallery}>
          {PUZZLE_LIBRARY.map((picture) => (
            <li className={styles.galleryItem} key={picture.src}>
              <img
                src={picture.src}
                alt={picture.alt}
                width={picture.width}
                height={picture.height}
                loading="lazy"
                decoding="async"
                className={styles.galleryImage}
              />
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>How it works in a classroom</h2>
        {/*
          Headed by what a person is trying to do, not by the feature's name.

          The card these replaced said images "live in cloud storage and are
          served from a CDN" — which is not true today and is exactly the kind
          of third-party claim a district technology officer would go looking
          for. Everything is served from this one domain, which is a better
          answer anyway.
        */}
        <div className={styles.grid}>
          <Card title="Share it">
            Send one link through Google Classroom, Canvas, Schoology, Teams, or a printed QR code.
            The link stays the same, so a worksheet printed today still works next year.
          </Card>
          <Card title="Students play">
            They open the link and start solving. No email, no password, no account — and no class
            time lost to sign-ins that do not work.
          </Card>
          <Card title="Answer, and the picture appears">
            In Mystery Pictures, each correct answer reveals part of the image automatically.
            Learning Puzzle gives students the earned piece to place. Use either style with your
            math, science, or vocabulary questions.
          </Card>
          <Card title="Nothing to configure">
            Everything loads from this one website. No plugins, no extensions, no separate accounts,
            and no other companies involved.
            <div className={styles.cardAction}>
              <LinkButton to={paths.privacy} variant="secondary">
                What we collect
              </LinkButton>
            </div>
          </Card>
        </div>
      </section>
    </AppShell>
  )
}
