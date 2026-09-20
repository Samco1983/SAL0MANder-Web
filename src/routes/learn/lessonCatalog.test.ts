import { expect, it } from 'vitest'
import { ActivityDraftSchema } from '@studio/activityDraft'
import { parseDraftBackup, readDraftBackupFile } from '@studio/draftBackup'
import { LESSONS, courseLabel, lessonBackup } from './lessonCatalog'

it('loads only the four agreed pilots and validates every complete unchanged ActivityDraft', () => {
  expect(LESSONS.map(courseLabel)).toEqual(['Grade 6', 'Grade 7', 'Grade 8', 'Algebra I'])
  const sources = import.meta.glob<string>('/content/tutoring-pilot/ca-*.json', {
    eager: true,
    query: '?raw',
    import: 'default',
  })
  for (const lesson of LESSONS) {
    const source = JSON.parse(sources[`/content/tutoring-pilot/${lesson.id}.json`]!)
    expect(ActivityDraftSchema.parse(lesson.activityDraft)).toEqual(source.activityDraft)
    expect(lesson.activityDraft.questions).toHaveLength(12)
    expect(lesson.activityDraft.meta.optionsReviewed).toBe(false)
    expect(lesson.activityDraft.meta.imageKey).toBe('')
    expect(lesson.activityDraft.config.activityType).toBe('MysteryReveal')
    expect(lesson.questionNotes).toHaveLength(12)
    lesson.questionNotes.forEach((note, index) => {
      expect(note.skill).toBe(source.questionNotes[index].skill)
      expect(note.standardIds).toEqual(source.questionNotes[index].standardIds)
      expect(note.verification).toEqual(source.questionNotes[index].verification)
    })
  }
})

it.each(LESSONS)(
  'exports $id through the actual Studio file reader without losing any draft field',
  async (lesson) => {
    const text = lessonBackup(lesson, '2026-09-11T00:00:00Z')
    expect(parseDraftBackup(text)).toEqual([lesson.activityDraft])
    const imported = await readDraftBackupFile(
      new File([text], `${lesson.id}.studio-backup.json`, { type: 'application/json' }),
    )
    expect(imported).toEqual([lesson.activityDraft])
    expect(JSON.parse(text)).not.toHaveProperty('teacherGuide')
  },
)
