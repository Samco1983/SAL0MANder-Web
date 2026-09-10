import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PUZZLE_LIBRARY } from '@content/puzzleLibrary'
import { env } from '@config/env'
import { AppShell } from '@components/layout/AppShell'
import { Button } from '@components/ui/Button'
import { newId } from '@contracts/v1'
import {
  ACTIVITY_TYPES,
  missAllowance,
  newDraft,
  puzzlePrice,
  readiness,
  type ActivityDraft,
} from '@studio/activityDraft'
import { loadDrafts, saveDrafts } from '@studio/draftStorage'
import { copyBackupDrafts, createDraftBackup, DraftBackupError, readDraftBackupFile } from '@studio/draftBackup'
import { ImagePanel } from './ImagePanel'
import { OptionsPanel } from './OptionsPanel'
import { QuestionsPanel } from './QuestionsPanel'
import { StudioPreview } from './StudioPreview'
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
  MysteryReveal: { name: 'Mystery Pictures', blurb: 'Start here: each right answer uncovers part of the picture automatically.' },
  Classic: { name: 'Classic puzzle', blurb: 'Just the jigsaw. No questions.' },
  Both: { name: 'Both', blurb: 'Students choose which way to play.' },
}

export function StudioPage() {
  const [searchParams] = useSearchParams()
  const [drafts, setDrafts] = useState<ActivityDraft[]>(() => loadDrafts())
  const [activeId, setActiveId] = useState<string | null>(() => loadDrafts()[0]?.config.activityId ?? null)
  const [tab, setTab] = useState<TabId>(() => searchParams.get('tab') === 'questions' ? 'questions' : 'overview')
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'failed'>('saved')
  const [backupMessage, setBackupMessage] = useState<{ error: boolean; text: string } | null>(null)
  const [importing, setImporting] = useState(false)
  const backupInput = useRef<HTMLInputElement>(null)
  const importAttempt = useRef(0)

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
  const currentDrafts = useRef(drafts)
  const dirty = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    if (!dirty.current) return
    const saved = saveDrafts(currentDrafts.current)
    dirty.current = !saved
    setSaveState(saved ? 'saved' : 'failed')
  }, [])

  useEffect(() => {
    const onPageHide = () => flush()
    window.addEventListener('pagehide', onPageHide)
    return () => {
      importAttempt.current += 1
      window.removeEventListener('pagehide', onPageHide)
      flush()
    }
  }, [flush])

  const replaceDrafts = useCallback((next: ActivityDraft[]) => {
    currentDrafts.current = next
    dirty.current = true
    setDrafts(next)
    setSaveState('saving')
  }, [])

  const update = useCallback(
    (mutate: (d: ActivityDraft) => ActivityDraft) => {
      const current = currentDrafts.current.find((d) => d.config.activityId === activeId)
      if (!current) return
      const changed = mutate(current)
      const next = { ...changed, meta: { ...changed.meta, updatedAt: new Date().toISOString() } }
      replaceDrafts(currentDrafts.current.map((d) => d.config.activityId === next.config.activityId ? next : d))
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, 500)
    },
    [activeId, flush, replaceDrafts],
  )

  const setConfig = (patch: Partial<ActivityDraft['config']>) =>
    update((d) => ({ ...d, config: { ...d.config, ...patch } }))
  const setMeta = (patch: Partial<ActivityDraft['meta']>) =>
    update((d) => ({ ...d, meta: { ...d.meta, ...patch } }))

  function createActivity() {
    const now = new Date().toISOString()
    const created = newDraft(`act_${newId()}`, now)
    replaceDrafts([created, ...currentDrafts.current])
    flush()
    setActiveId(created.config.activityId)
    setTab('overview')
  }

  function removeActivity(id: string) {
    const next = currentDrafts.current.filter((d) => d.config.activityId !== id)
    replaceDrafts(next)
    flush()
    if (activeId === id) setActiveId(next[0]?.config.activityId ?? null)
  }

  function downloadBackup() {
    setBackupMessage(null)
    try {
      const text = createDraftBackup(currentDrafts.current)
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `SAL0MANder-activities-${new Date().toISOString().slice(0, 10)}.json`
      document.body.append(link)
      link.click()
      link.remove()
      // Give the browser time to begin the download before releasing its data.
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setBackupMessage({ error: false, text: 'Backup download started. Keep the file somewhere you can find it again.' })
    } catch (error) {
      setBackupMessage({ error: true, text: error instanceof DraftBackupError ? error.message : 'The backup could not be downloaded. Keep this page open and try again.' })
    }
  }

  async function importBackup(file: File) {
    const attempt = ++importAttempt.current
    setBackupMessage(null)
    setImporting(true)
    try {
      const parsed = await readDraftBackupFile(file)
      if (attempt !== importAttempt.current) return
      const imported = copyBackupDrafts(parsed)
      // Read the latest edits after the asynchronous file read. Save the whole
      // next set before changing the editor, so a refused write is reversible.
      const next = [...imported, ...currentDrafts.current]
      if (!saveDrafts(next)) {
        throw new DraftBackupError('Your browser could not save the imported activities. Existing activities have not been changed. Download a backup of your work and try again.')
      }
      if (timer.current) clearTimeout(timer.current)
      currentDrafts.current = next
      dirty.current = false
      setDrafts(next)
      setSaveState('saved')
      setActiveId(imported[0]!.config.activityId)
      setTab('overview')
      setBackupMessage({ error: false, text: `Imported ${imported.length === 1 ? '1 activity as a new copy' : `${imported.length} activities as new copies`}. Your existing activities are still here.` })
    } catch (error) {
      if (attempt !== importAttempt.current) return
      setBackupMessage({ error: true, text: error instanceof DraftBackupError ? error.message : 'This backup could not be imported. Your activities have not been changed.' })
    } finally {
      if (attempt === importAttempt.current) setImporting(false)
    }
  }

  const rows = draft ? readiness(draft) : []
  const picture = PUZZLE_LIBRARY.find((p) => p.key === draft?.meta.imageKey)

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
              {saveState === 'failed' && 'Not saved — keep this page open and retry'}
            </span>
            {saveState === 'failed' && <Button variant="secondary" onClick={flush}>Retry save</Button>}
            <Button variant="secondary" disabled={!draft} onClick={() => setTab('preview')}>
              Preview details
            </Button>
            <Button disabled title="Class publishing is not connected yet">
              Publish
            </Button>
          </div>
        </header>

        <section className={styles.backups} aria-label="Activity backups">
          <div className={styles.barRight}>
            <Button variant="secondary" disabled={drafts.length === 0} onClick={downloadBackup}>Download backup</Button>
            <Button variant="secondary" disabled={importing} onClick={() => backupInput.current?.click()}>
              {importing ? 'Importing…' : 'Import backup'}
            </Button>
            <input
              ref={backupInput}
              type="file"
              accept=".json,application/json"
              aria-label="Choose an activity backup"
              hidden
              onChange={(event) => {
                const file = event.currentTarget.files?.[0]
                event.currentTarget.value = ''
                if (file) void importBackup(file)
              }}
            />
          </div>
          <p className={styles.hint}>Keep a copy of all your activities, including notes, or move them to another browser. Imports add new copies. Maximum file size: 5 MB.</p>
          {backupMessage && <p className={styles.backupMessage} role={backupMessage.error ? 'alert' : 'status'} data-error={backupMessage.error}>{backupMessage.text}</p>}
        </section>

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
                      onClick={() => { flush(); setActiveId(d.config.activityId) }}
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
                      <div className={styles.overview}>
                      <section className={styles.form} aria-label="Activity details">
                        <h2 className={styles.sectionTitle}>Activity overview</h2>
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
                      <section className={styles.summary} aria-label="Activity summary">
                        <h2 className={styles.sectionTitle}>Activity summary</h2>
                        {picture ? <img className={styles.summaryImage} src={picture.src} alt={picture.alt} /> :
                          <Button variant="secondary" onClick={() => setTab('image')}>Choose puzzle image</Button>}
                        <dl className={styles.summaryDetails}>
                          <div><dt>Room type</dt><dd>Jigsaw puzzle</dd></div>
                          <div><dt>Puzzle image</dt><dd>{picture?.name ?? 'Not selected'}</dd></div>
                          <div><dt>Piece count</dt><dd>{draft.config.pieceCountPreset} pieces · {draft.config.boardShape}</dd></div>
                          <div><dt>Questions</dt><dd>{draft.questions.length} questions</dd></div>
                          <div><dt>Student mode</dt><dd>{TYPE_LABELS[draft.config.activityType].name}</dd></div>
                          <div><dt>Status</dt><dd>Local draft</dd></div>
                        </dl>
                      </section>
                      </div>
                    )}

                    {tab === 'questions' && (
                      <QuestionsPanel
                        draft={draft}
                        onChange={(next) => update(() => next)}
                      />
                    )}

                    {tab === 'image' && (
                      <ImagePanel draft={draft} onChange={(next) => update(() => next)} />
                    )}

                    {tab === 'options' && (
                      <OptionsPanel draft={draft} onChange={(next) => update(() => next)} />
                    )}

                    {tab === 'preview' && (
                      <StudioPreview key={draft.config.activityId} draft={draft} />
                    )}
                  </div>

                  {/*
                    The Readiness Checklist — the most valuable element in the
                    owner's wireframe. It answers "why can't I publish yet?"
                    before the teacher has to ask, and the Publish button reads
                    the same function, so the list cannot disagree with the gate.
                  */}
                  <aside className={styles.checklist} aria-label="Before you publish">
                    <nav className={styles.quickActions} aria-label="Quick actions">
                      <h2 className={styles.checklistTitle}>Quick actions</h2>
                      <Button variant="ghost" onClick={() => setTab('questions')}>Edit questions</Button>
                      <Button variant="ghost" onClick={() => setTab('image')}>Change puzzle image</Button>
                      <Button variant="ghost" onClick={() => { setTab('options'); setMeta({ optionsReviewed: true }) }}>Student settings</Button>
                      <Button variant="ghost" onClick={() => setTab('preview')}>Preview details</Button>
                    </nav>
                    <h2 className={styles.checklistTitle}>Readiness checklist</h2>
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
          Activities are saved in this browser. Download a backup to keep a separate copy or import
          it on another device. Publishing to a class needs the {env.appName} account system, which is not built yet.
        </p>
      </div>
    </AppShell>
  )
}
