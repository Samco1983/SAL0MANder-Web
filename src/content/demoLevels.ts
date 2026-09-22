/** Navigation metadata only. DemoLevelCatalog.cs in Unity owns every question and puzzle. */
export const DEMO_LEVEL_NAMES = ['Warm-up', 'Practice', 'Challenge'] as const
const pieceCounts = [4, 9, 16] as const
const series = [
  {
    key: 'integer',
    title: 'Integer Operations',
    description: 'Start with signed numbers, then combine operations and solve everyday problems.',
  },
  {
    key: 'inequality',
    title: 'One-Step Inequalities',
    description: 'Start with positive operations, then reverse signs and interpret solutions.',
  },
  {
    key: 'linear',
    title: 'Linear Equations',
    description:
      'Build from one-step equations to two steps, distribution and variables on both sides.',
  },
  {
    key: 'classic',
    title: 'Classic Jigsaw',
    description: 'Put the whole picture together. More pieces each level; no questions.',
  },
  {
    key: 'matching',
    title: 'Matching',
    description:
      'Swap two photo tiles to restore the picture. Start one swap away, then try harder arrangements.',
  },
] as const

export type DemoLevel = {
  id: string
  series: string
  title: string
  courseTitle: string
  description: string
  level: number
  label: (typeof DEMO_LEVEL_NAMES)[number]
  pieceCount: number
  mode: 'learning-puzzle' | 'classic-puzzle'
  nextId?: string
  previousId?: string
}

export const DEMO_LEVELS: readonly DemoLevel[] = series.flatMap((course) =>
  DEMO_LEVEL_NAMES.map((label, index) => ({
    id: `act_demo_${course.key}_${index + 1}`,
    series: course.key,
    courseTitle: course.title,
    title: `${course.title} · ${label}`,
    description: course.description,
    level: index + 1,
    label,
    pieceCount: course.key === 'matching' ? 4 : pieceCounts[index]!,
    mode:
      course.key === 'classic' || course.key === 'matching'
        ? ('classic-puzzle' as const)
        : ('learning-puzzle' as const),
    ...(index < 2 ? { nextId: `act_demo_${course.key}_${index + 2}` } : {}),
    ...(index > 0 ? { previousId: `act_demo_${course.key}_${index}` } : {}),
  })),
)

export function findDemoLevel(id: string | undefined): DemoLevel | undefined {
  return DEMO_LEVELS.find((level) => level.id === id)
}

export const DEMO_MATH_COURSES = DEMO_LEVELS.filter(
  (level) => level.level === 1 && level.mode === 'learning-puzzle',
).map((level) => ({ ...level, title: level.courseTitle }))
export const DEMO_CLASSIC_COURSE = DEMO_LEVELS.find(
  (level) => level.level === 1 && level.series === 'classic',
)!

export const DEMO_MATCHING_COURSE = DEMO_LEVELS.find(
  (level) => level.level === 1 && level.series === 'matching',
)!
