import { DEFAULT_PIECE_COUNT, type AuthoringQuestion } from '@contracts/authoring'

export type ImportedQuestionRow = {
  line: number
  prompt: string
  answer: string
  issue?: string
}

export type QuestionImportResult = {
  rows: ImportedQuestionRow[]
  questions: AuthoringQuestion[]
  flaggedCount: number
}

const DELIMITERS = ['\t', '|'] as const

function splitLine(line: string): [string, string] | null {
  for (const delimiter of DELIMITERS) {
    const position = line.indexOf(delimiter)
    if (position >= 0) {
      return [line.slice(0, position).trim(), line.slice(position + delimiter.length).trim()]
    }
  }
  return null
}

export function parseQuestionImport(source: string): QuestionImportResult {
  const rawLines = source
    .split(/\r?\n/)
    .map((value, index) => ({ value: value.trim(), line: index + 1 }))
    .filter(({ value }) => value.length > 0)

  const promptCounts = new Map<string, number>()
  for (const { value } of rawLines) {
    const fields = splitLine(value)
    if (!fields || !fields[0]) continue
    const normalized = fields[0].toLocaleLowerCase()
    promptCounts.set(normalized, (promptCounts.get(normalized) ?? 0) + 1)
  }

  const rows = rawLines.map(({ value, line }, rowIndex): ImportedQuestionRow => {
    const fields = splitLine(value)
    if (!fields)
      return { line, prompt: value, answer: '', issue: 'Missing question/answer separator.' }

    const [prompt, answer] = fields
    if (!prompt) return { line, prompt, answer, issue: 'Question is empty.' }
    if (!answer) return { line, prompt, answer, issue: 'Answer is empty.' }
    if (prompt.length > 240)
      return { line, prompt, answer, issue: 'Question is over 240 characters.' }
    if (answer.length > 120)
      return { line, prompt, answer, issue: 'Answer is over 120 characters.' }
    if ((promptCounts.get(prompt.toLocaleLowerCase()) ?? 0) > 1) {
      return { line, prompt, answer, issue: 'Duplicate question.' }
    }
    if (rowIndex >= DEFAULT_PIECE_COUNT) {
      return { line, prompt, answer, issue: 'No puzzle piece is available for this question.' }
    }
    return { line, prompt, answer }
  })

  const questions = rows.flatMap((row, index): AuthoringQuestion[] =>
    row.issue
      ? []
      : [
          {
            id: `question-${index + 1}`,
            prompt: row.prompt,
            answer: row.answer,
            pieceIndex: index,
          },
        ],
  )

  return {
    rows,
    questions,
    flaggedCount: rows.filter((row) => row.issue).length,
  }
}
