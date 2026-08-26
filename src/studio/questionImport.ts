import { DEFAULT_PIECE_COUNT, type AuthoringQuestion } from '@contracts/authoring'

export type ImportedQuestionRow = {
  id: string
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

export function validateQuestionRows(
  inputRows: Array<Omit<ImportedQuestionRow, 'line' | 'issue'>>,
): QuestionImportResult {
  const promptCounts = new Map<string, number>()
  for (const row of inputRows) {
    const normalized = row.prompt.trim().toLocaleLowerCase()
    if (!normalized) continue
    promptCounts.set(normalized, (promptCounts.get(normalized) ?? 0) + 1)
  }

  const rows = inputRows.map((input, rowIndex): ImportedQuestionRow => {
    const prompt = input.prompt.trim()
    const answer = input.answer.trim()
    const row = { id: input.id, line: rowIndex + 1, prompt, answer }

    if (!prompt) return { ...row, issue: 'Question is empty.' }
    if (!answer) return { ...row, issue: 'Answer is empty.' }
    if (prompt.length > 240) return { ...row, issue: 'Question is over 240 characters.' }
    if (answer.length > 120) return { ...row, issue: 'Answer is over 120 characters.' }
    if ((promptCounts.get(prompt.toLocaleLowerCase()) ?? 0) > 1) {
      return { ...row, issue: 'Duplicate question.' }
    }
    if (rowIndex >= DEFAULT_PIECE_COUNT) {
      return { ...row, issue: 'No puzzle piece is available for this question.' }
    }
    return row
  })

  const questions = rows
    .filter((row) => !row.issue)
    .map((row, pieceIndex): AuthoringQuestion => ({
      id: row.id,
      prompt: row.prompt,
      answer: row.answer,
      pieceIndex,
    }))

  return {
    rows,
    questions,
    flaggedCount: rows.filter((row) => row.issue).length,
  }
}

export function parseQuestionImport(source: string): QuestionImportResult {
  const rawLines = source
    .split(/\r?\n/)
    .map((value, index) => ({ value: value.trim(), line: index + 1 }))
    .filter(({ value }) => value.length > 0)

  const parsedRows = rawLines.map(({ value, line }) => {
    const fields = splitLine(value)
    return {
      id: `question-${line}`,
      prompt: fields?.[0] ?? value,
      answer: fields?.[1] ?? '',
      separatorMissing: !fields,
    }
  })

  const result = validateQuestionRows(parsedRows)
  return {
    ...result,
    rows: result.rows.map((row, index) =>
      parsedRows[index]?.separatorMissing
        ? { ...row, issue: 'Missing question/answer separator.' }
        : row,
    ),
    questions: result.questions.filter(
      (question) => !parsedRows.find((row) => row.id === question.id)?.separatorMissing,
    ),
    flaggedCount: result.rows.filter(
      (row, index) => row.issue || parsedRows[index]?.separatorMissing,
    ).length,
  }
}
