import { env } from '@config/env'
import { paths } from '@config/routes'
import { AppShell } from '@components/layout/AppShell'
import { LinkButton } from '@components/ui/Button'
import styles from './AboutPage.module.css'

/**
 * Why this exists, in the author's own words.
 *
 * The last of the pages a web filter's reviewer looks for, and the only one an
 * agent should not have written. Everything below is the owner's draft, edited
 * for length and order rather than for voice — the specificity is the value,
 * and polishing it out would leave the generic founder page every unfinished
 * product has.
 *
 * ## Two decisions worth keeping
 *
 * **Math teacher, not math product.** The origin is a math classroom, and
 * saying so is what makes the page credible — "I'm a high school math teacher"
 * is checkable in a way that "we believe in engagement" is not. But the puzzle
 * is a format, and Unity already ships cell biology and vocabulary activities
 * alongside quadratics. So the credibility is math and the product is not.
 *
 * **The first paragraph says what the thing is.** A reader who arrives without
 * context — a district reviewer, a filter's crawler, a teacher following a QR
 * code — should not have to reach paragraph four to learn that. The story is
 * better once you already know what it is about.
 *
 * ## What it does not do
 *
 * No compliance claim, and nothing for sale. `TPT-RULES.md` records that the
 * page a scanned QR lands on must not sell anything or advertise anything for
 * sale, and that is enforced by a test here as it is on the terms page.
 */
export function AboutPage() {
  return (
    <AppShell>
      <div className={styles.page}>
        <header className={styles.header}>
          <p className={styles.eyebrow}>About</p>
          <h1 className={styles.title}>Why I built {env.appName}</h1>
          <p className={styles.lede}>
            {env.appName} is a classroom activity: students answer questions to uncover a jigsaw
            puzzle, one piece at a time. Teachers write the questions, so an activity can be about
            equations, cell structure, vocabulary, or anything else being taught.
          </p>
        </header>

        <article className={styles.prose}>
          <p>
            I&apos;m a high school math teacher, and {env.appName} came from something pretty
            simple: I kept asking myself how to get students to stay with the learning a little
            longer.
          </p>

          <p>
            Not every lesson lands. Not every student comes in ready to learn. Sometimes
            they&apos;re tired, distracted, frustrated, or they&apos;ve already decided that math is
            not for them. But every once in a while you change the way something is presented, and
            you see that student lean forward instead of back.
          </p>

          <p className={styles.pull}>
            As a teacher, you notice those moments. And you want more of them.
          </p>

          <p>
            I&apos;ve always appreciated games — not just because they&apos;re fun, but because of
            what they can get people to do. You&apos;ll fail at something in a game and try it
            again. You&apos;ll work through a challenge because you want to see what happens next.
            You&apos;ll keep going because you can feel yourself making progress.
          </p>

          <p>I started wondering how much of that could be used for learning.</p>

          <p>
            Not by turning every classroom into a video game. Not by throwing points and badges on
            top of a worksheet and calling it innovation. I mean using some of those ideas with
            purpose. A student answers a question and something actually happens. A puzzle piece
            unlocks. A picture starts coming together. Progress becomes visible. There&apos;s a
            reason to take the next step.
          </p>

          <p>
            Later, I want to push that further — to explore what happens when the game itself helps
            reveal the concept, where students learn something through the way they play,
            experiment, build, or solve, rather than because they answered a question and got a
            reward afterward. That is the part that really interests me, and it is where I want this
            to go next.
          </p>

          <h2 className={styles.sectionTitle}>It started with math. It was never meant to stop there.</h2>

          <p>
            Math is the classroom I know best, so it is where I started. But the question underneath
            it isn&apos;t a math question — it&apos;s how games, feedback, and interaction can be
            used in service of real learning, in any subject. A teacher writes the questions here,
            so the same activity works for a science review or a vocabulary unit as well as it does
            for equations.
          </p>

          <p>
            I want {env.appName} to grow into something teachers in different subjects can build
            with, using their own content, while keeping the same focus on engagement, persistence,
            and learning that means something.
          </p>

          <h2 className={styles.sectionTitle}>What I actually think it is</h2>

          <p>
            {env.appName} has already changed the way I think about my own teaching. It makes me ask
            whether an activity is really giving students a reason to engage, whether the feedback
            means anything, and whether there&apos;s another way to help an idea click.
          </p>

          <p className={styles.pull}>
            I don&apos;t think {env.appName} is the answer to education. I do think it can be part
            of something bigger.
          </p>

          <p>
            Teachers everywhere are constantly adjusting, trying something new, borrowing ideas from
            each other, and looking for one more way to reach the students in front of them. That
            work matters. And with everything happening in technology right now, teachers need to be
            part of deciding what comes next instead of having it handed to us. This is one way I
            can contribute to that.
          </p>

          <p>
            If {env.appName} helps a student understand something they were struggling with, gives a
            teacher another tool that actually works in their classroom, or leads to an idea
            somebody else takes further, then something meaningful happened.
          </p>

          <p>That&apos;s the kind of progress I believe in, and I&apos;m going to keep building toward it.</p>
        </article>

        <section className={styles.section} aria-labelledby="contact">
          <h2 className={styles.sectionTitle} id="contact">
            Get in touch
          </h2>
          <p>
            Teachers and general questions:{' '}
            <a className={styles.link} href="mailto:support@sal0mander.com">
              support@sal0mander.com
            </a>
          </p>
          <p>
            Privacy, student data, and district technology staff:{' '}
            <a className={styles.link} href="mailto:privacy@sal0mander.com">
              privacy@sal0mander.com
            </a>
          </p>
        </section>

        <footer className={styles.footer}>
          <LinkButton to={paths.home}>Try an activity</LinkButton>
          <LinkButton to={paths.privacy} variant="secondary">
            Privacy &amp; student data
          </LinkButton>
          <LinkButton to={paths.terms} variant="secondary">
            Terms of use
          </LinkButton>
        </footer>
      </div>
    </AppShell>
  )
}
