import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { env } from '@config/env'
import { AppShell } from '@components/layout/AppShell'
import { Button } from '@components/ui/Button'
import { PlaceholderNotice } from '@components/ui/PlaceholderNotice'
import { newId } from '@contracts/v1'
import {
  ACTIVITY_TYPES,
  BOARD_SHAPES,
  PIECE_COUNTS,
  canPublish,
  missAllowance,
  newDraft,
  puzzlePrice,
  readiness,
  type ActivityDraft,
} from '@studio/activityDraft'
import { deleteDraft, loadDrafts, upsertDraft } from '@studio/draftStorage'
import { QuestionsPanel } from './QuestionsPanel'
import styles from './StudioPage.module.css'

/**
 * Teacher Studio — where a teacher builds an activity.
 *
 * Built to the owner's wireframe, transcribed in
 * `docs/coordination/SPEC-TEACHER-STUDIO-ACTIVITY-EDITOR.md`.
 *
 * ## Why this is a web page and not a screen inside the game
 *
 * Owner's decision, 2026-09-02. The editor lived inside the Unity build, so
 * changing a single label meant a 93 MB rebuild, a manual file copy and a
 * deploy — a round trip measured at 22 hours on 2026-08-30, during which five
 * fixes never reached the site. `TeacherStudioUI.cs` was rebuilt five times in
 * one day without matching the wireframe, and the slow loop is most of why.
 *
 * Here the same change is live in minutes. Browser zoom answers the text-size
 * request outright, a screen reader can read the form, and a teacher does not
 * download a game engine to type a title.
 *
 * Gameplay does not move. Questions, puzzle, drag and release stay in Unity, on
 * every platform, because two implementations of the rules would drift.
 *
 * ## Written for a laptop
 *
 * The owner confirmed teachers author on laptops. So this targets laptop widths
 * and up rather than carrying a phone-first authoring layout nobody uses — the
 * responsive burden belongs on the student surface, which Unity owns.
 *
 * ## Autosave is real
 *
 * "All changes saved automatically" is a promise, and a save state that lies is
 * worse than none. `saveDrafts` returns false when the browser refuses, and
 * this reports that rather than showing "Saved" over lost work.
 */

type TabId = 'overview' | 'questions' | 'image' | 'options' | 'preview'

const TABS: { id: TabId; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'questions', label: 'Questions' },
  { id: 'image', label: 'Puzzle & image' },
  { id: 'options', label: 'Student options' },
  { id: 'preview', label: 'Preview' },
]

const SUBJECTS = ['Mathematics', 'Science', 'English / language arts', 'Social studies', 'Other']
const GRADES = ['3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th']

const TYPE_LABELS: Record<(typeof ACTIVITY_TYPES)[number], { name: string; blurb: string }> = {
  Learning: { name: 'Learning puzzle', blurb: 'Answer a question, then place the piece yourself.' },
  MysteryReveal: { name: 'Mystery reveal', blurb: 'Answer a question and the piece places itself. No dragging.' },
  Classic: { name: 'Classic puzzle', blurb: 'Just the jigsaw. No questions.' },
  Both: { name: 'Both', blurb: 'Students choose which way to play.' },
}

export function StudioPage() {
  const [drafts, setDrafts] = useState<ActivityDraft[]>(() => loadDrafts())
  const [activeId, setActiveId] = useState<string | null>(() => loadDrafts()[0]?.config.activityId ?? null)
  const [tab, setTab] = useState<TabId>('overview')
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'failed'>('saved')

  const draft = useMemo(
    () => drafts.find((d) => d.config.activityId === activeId) ?? null,
    [drafts, activeId],
  )

  /*
    Autosave is debounced so a teacher typing a title does not write to storage
    on every keystroke. The timer is cleared on unmount, and the pending edit is
    flushed first — losing the last word someone typed is exactly the kind of
    small betrayal that stops people trusting a tool.
  */
  const pending = useRef<ActivityDraft | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(() => {
    const next = pending.current
    if (!next) return
    pending.current = null
    const ok = upsertDraft(next, new Date().toISOString())
    setDrafts(ok)
    setSaveState(ok.some((d) => d.config.activityId === next.config.activityId) ? 'saved' : 'failed')
  }, [])

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
      flush()
    }
  }, [flush])

  const update = useCallback(
    (mutate: (d: ActivityDraft) => ActivityDraft) => {
      if (!draft) return
      const next = mutate(draft)
      setDrafts((all) => all.map((d) => (d.config.activityId === next.config.activityId ? next : d)))
      pending.current = next
      setSaveState('saving')
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, 500)
    },
    [draft, flush],
  )

  const setConfig = (patch: Partial<ActivityDraft['config']>) =>
    update((d) => ({ ...d, config: { ...d.config, ...patch } }))
  const setMeta = (patch: Partial<ActivityDraft['meta']>) =>
    update((d) => ({ ...d, meta: { ...d.meta, ...patch } }))

  function createActivity() {
    const now = new Date().toISOString()
    const created = newDraft(`act_${newId()}`, now)
    setDrafts(upsertDraft(created, now))
    setActiveId(created.config.activityId)
    setTab('overview')
  }

  function removeActivity(id: string) {
    const next = deleteDraft(id)
    setDrafts(next)
    if (activeId === id) setActiveId(next[0]?.config.activityId ?? null)
  }

  const rows = draft ? readiness(draft) : []
  const publishable = draft ? canPublish(draft) : false

  return (
    <AppShell>
      <div className={styles.studio}>
        <header className={styles.bar}>
          <div className={styles.barLeft}>
            <p className={styles.eyebrow}>Teacher Studio</p>
            <h1 className={styles.title}>{draft?.config.title.trim() || 'Untitled activity'}</h1>
          </div>
          <div className={styles.barRight}>
            <span
              className={styles.saveState}
              data-state={saveState}
              role="status"
              aria-live="polite"
            >
              {saveState === 'saved' && 'All changes saved'}
              {saveState === 'saving' && 'Saving…'}
              {saveState === 'failed' && 'Not saved — this browser is blocking storage'}
            </span>
            <Button variant="secondary" disabled={!draft}>
              Preview as student
            </Button>
            <Button disabled={!publishable} title={publishable ? undefined : 'Finish the checklist first'}>
              Publish
            </Button>
          </div>
        </header>

        <div className={styles.body}>
          <nav className={styles.rail} aria-label="Your activities">
            <div className={styles.railHead}>
              <h2 className={styles.railTitle}>Activities</h2>
              <Button size="sm" onClick={createActivity}>
                New
              </Button>
            </div>
            {drafts.length === 0 ? (
              <p className={styles.railEmpty}>Nothing here yet. Create your first activity.</p>
            ) : (
              <ul className={styles.railList}>
                {drafts.map((d) => (
                  <li key={d.config.activityId}>
                    <button
                      type="button"
                      className={styles.railItem}
                      aria-current={d.config.activityId === activeId ? 'true' : undefined}
                      onClick={() => setActiveId(d.config.activityId)}
                    >
                      <span className={styles.railItemTitle}>
                        {d.config.title.trim() || 'Untitled activity'}
                      </span>
                      <span className={styles.railItemMeta}>
                        {d.config.pieceCountPreset} pieces · {d.questions.length} questions
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </nav>

          <main className={styles.main}>
            {!draft ? (
              <div className={styles.blank}>
                <h2 className={styles.blankTitle}>Build your first activity</h2>
                <p className={styles.blankText}>
                  Give it a title, pick a picture, and write your questions. Students answer to
                  uncover the picture — there is nothing for them to install or sign in to.
                </p>
                <Button onClick={createActivity}>Create an activity</Button>
              </div>
            ) : (
              <>
                <div className={styles.tabs} role="tablist" aria-label="Activity sections">
                  {TABS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      id={`tab-${t.id}`}
                      aria-selected={tab === t.id}
                      aria-controls={`panel-${t.id}`}
                      className={styles.tab}
                      onClick={() => {
                        setTab(t.id)
                        if (t.id === 'options') setMeta({ optionsReviewed: true })
                      }}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                <div className={styles.panels}>
                  <div
                    className={styles.panel}
                    role="tabpanel"
                    id={`panel-${tab}`}
                    aria-labelledby={`tab-${tab}`}
                  >
                    {tab === 'overview' && (
                      <section className={styles.form} aria-label="Activity details">
                        <label className={styles.field}>
                          <span className={styles.label}>Activity title</span>
                          <input
                            className={styles.input}
                            value={draft.config.title}
                            placeholder="Solar system puzzle"
                            onChange={(e) => setConfig({ title: e.target.value })}
                          />
                        </label>

                        <div className={styles.fieldRow}>
                          <label className={styles.field}>
                            <span className={styles.label}>Subject</span>
                            <select
                              className={styles.input}
                              value={draft.meta.subject}
                              onChange={(e) => setMeta({ subject: e.target.value })}
                            >
                              <option value="">Choose a subject</option>
                              {SUBJECTS.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className={styles.field}>
                            <span className={styles.label}>Grade level</span>
                            <select
                              className={styles.input}
                              value={draft.meta.gradeLevel}
                              onChange={(e) => setMeta({ gradeLevel: e.target.value })}
                            >
                              <option value="">Choose a grade</option>
                              {GRADES.map((g) => (
                                <option key={g} value={g}>
                                  {g} grade
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <label className={styles.field}>
                          <span className={styles.label}>Description</span>
                          <textarea
                            className={styles.textarea}
                            rows={3}
                            value={draft.meta.description}
                            placeholder="What will students practise?"
                            onChange={(e) => setMeta({ description: e.target.value })}
                          />
                        </label>

                        <fieldset className={styles.fieldset}>
                          <legend className={styles.label}>How students play</legend>
                          <div className={styles.choices}>
                            {ACTIVITY_TYPES.map((t) => (
                              <label key={t} className={styles.choice} data-selected={draft.config.activityType === t}>
                                <input
                                  type="radio"
                                  name="activityType"
                                  checked={draft.config.activityType === t}
                                  onChange={() =>
                                    setConfig({
                                      activityType: t,
                                      // Mystery reveal IS auto-place; they are
                                      // the same switch under two names.
                                      autoPlaceCorrectPieces: t === 'MysteryReveal',
                                    })
                                  }
                                />
                                <span className={styles.choiceName}>{TYPE_LABELS[t].name}</span>
                                <span className={styles.choiceBlurb}>{TYPE_LABELS[t].blurb}</span>
                              </label>
                            ))}
                          </div>
                        </fieldset>

                        <div className={styles.fieldRow}>
                          <label className={styles.field}>
                            <span className={styles.label}>Puzzle pieces</span>
                            <select
                              className={styles.input}
                              value={draft.config.pieceCountPreset}
                              onChange={(e) =>
                                setConfig({
                                  pieceCountPreset: Number(e.target.value) as (typeof PIECE_COUNTS)[number],
                                })
                              }
                            >
                              {PIECE_COUNTS.map((n) => (
                                <option key={n} value={n}>
                                  {n} pieces
                                </option>
                              ))}
                            </select>
                          </label>
                          <label className={styles.field}>
                            <span className={styles.label}>Board shape</span>
                            <select
                              className={styles.input}
                              value={draft.config.boardShape}
                              onChange={(e) =>
                                setConfig({ boardShape: e.target.value as (typeof BOARD_SHAPES)[number] })
                              }
                            >
                              {BOARD_SHAPES.map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>

                        <label className={styles.field}>
                          <span className={styles.label}>Your notes</span>
                          <span className={styles.hint}>Only you can see these.</span>
                          <textarea
                            className={styles.textarea}
                            rows={2}
                            value={draft.meta.notes}
                            onChange={(e) => setMeta({ notes: e.target.value })}
                          />
                        </label>

                        <div className={styles.dangerRow}>
                          <Button variant="secondary" onClick={() => removeActivity(draft.config.activityId)}>
                            Delete this activity
                          </Button>
                        </div>
                      </section>
                    )}

                    {tab === 'questions' && (
                      <QuestionsPanel
                        draft={draft}
                        onChange={(next) => update(() => next)}
                      />
                    )}

                    {tab === 'image' && (
                      <PlaceholderNotice
                        label="Building next"
                        title="Puzzle &amp; image"
                        pending={['Choose from the picture library', 'Upload your own picture']}
                      >
                        Uploading your own picture is switched off until image storage exists.
                        Built-in pictures work now.
                      </PlaceholderNotice>
                    )}

                    {tab === 'options' && (
                      <PlaceholderNotice
                        label="Building next"
                        title="Student options"
                        pending={['Hints on or off', 'Restart and resume', 'Show the finished picture']}
                      >
                        Opening this tab marks it as reviewed on the checklist. The controls
                        themselves land in the next pass.
                      </PlaceholderNotice>
                    )}

                    {tab === 'preview' && (
                      <PlaceholderNotice
                        label="Building next"
                        title="Preview"
                        pending={['Play the activity exactly as a student sees it']}
                      >
                        The preview loads the real game with this activity, so what you see is what
                        your class gets.
                      </PlaceholderNotice>
                    )}
                  </div>

                  {/*
                    The Readiness Checklist — the most valuable element in the
                    owner's wireframe. It answers "why can't I publish yet?"
                    before the teacher has to ask, and the Publish button reads
                    the same function, so the list cannot disagree with the gate.
                  */}
                  <aside className={styles.checklist} aria-label="Before you publish">
                    <h2 className={styles.checklistTitle}>Before you publish</h2>
                    <ul className={styles.checkRows}>
                      {rows.map((row) => (
                        <li key={row.id} className={styles.checkRow} data-complete={row.complete}>
                          <span className={styles.checkMark} aria-hidden="true">
                            {row.complete ? '●' : '○'}
                          </span>
                          <span className={styles.checkBody}>
                            <span className={styles.checkLabel}>{row.label}</span>
                            {!row.complete && <span className={styles.checkTodo}>{row.todo}</span>}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {puzzlePrice(draft) > 0 && (
                      <p className={styles.allowance}>
                        {draft.questions.length} question{draft.questions.length === 1 ? '' : 's'} ·
                        puzzle costs {puzzlePrice(draft)} ·{' '}
                        {missAllowance(draft) >= 0
                          ? `students can miss ${missAllowance(draft)}`
                          : `${-missAllowance(draft)} short — the picture cannot be finished`}
                      </p>
                    )}
                  </aside>
                </div>
              </>
            )}
          </main>
        </div>

        <p className={styles.footnote}>
          Activities are saved in this browser. Sharing them with a class or another teacher needs
          the {env.appName} account system, which is not built yet.
        </p>
      </div>
    </AppShell>
  )
}
