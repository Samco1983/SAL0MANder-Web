import { describe, expect, it } from 'vitest'
import { parseQuestionImport, validateQuestionRows } from './questionImport'

const validNine = Array.from(
  { length: 9 },
  (_, index) => `Question ${index + 1}? | ${index + 1}`,
).join('\n')

describe('question bulk import', () => {
  it('maps nine valid lines to nine distinct puzzle pieces', () => {
    const result = parseQuestionImport(validNine)

    expect(result.flaggedCount).toBe(0)
    expect(result.questions).toHaveLength(9)
    expect(result.questions.map((question) => question.pieceIndex)).toEqual([
      0, 1, 2, 3, 4, 5, 6, 7, 8,
    ])
  })

  it('accepts tab-delimited spreadsheet rows', () => {
    const result = parseQuestionImport('What is 3 + 4?\t7')
    expect(result.questions[0]).toMatchObject({ prompt: 'What is 3 + 4?', answer: '7' })
  })

  it('flags missing answers, duplicate prompts, and overflow rows', () => {
    const overflow = `${validNine}\nQuestion 10? | 10`
    expect(parseQuestionImport(overflow).rows.at(-1)?.issue).toMatch(/no puzzle piece/i)

    const duplicate = parseQuestionImport('Same? | 1\nSame? | 2')
    expect(duplicate.flaggedCount).toBe(2)

    expect(parseQuestionImport('Missing answer').rows[0]?.issue).toMatch(/separator/i)
  })

  it('revalidates repaired and reordered rows against the same piece contract', () => {
    const imported = parseQuestionImport('Same? | 1\nSame? | 2\nThird? | 3')
    const repaired = validateQuestionRows(
      imported.rows.map((row) => (row.line === 2 ? { ...row, prompt: 'Different?' } : row)),
    )

    expect(repaired.flaggedCount).toBe(0)
    expect(repaired.questions.map((question) => question.prompt)).toEqual([
      'Same?',
      'Different?',
      'Third?',
    ])
    expect(repaired.questions.map((question) => question.pieceIndex)).toEqual([0, 1, 2])
  })
})
