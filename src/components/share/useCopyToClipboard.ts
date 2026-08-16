import { useCallback, useEffect, useRef, useState } from 'react'

export type CopyState = 'idle' | 'copied' | 'failed'

/**
 * Copy-to-clipboard that tells the truth about whether it worked.
 *
 * `navigator.clipboard` is unavailable on insecure origins and can be denied by
 * permission policy — both realistic on a school-managed Chromebook reaching a
 * staging host over plain HTTP. A button that silently does nothing is worse
 * than one that admits it failed, because the teacher walks away believing the
 * link is on their clipboard.
 *
 * On failure the caller is expected to keep the raw link visible and
 * selectable, so there is always a manual path.
 */
export function useCopyToClipboard(resetAfterMs = 2000) {
  const [state, setState] = useState<CopyState>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // A copy landing just before unmount must not set state afterwards.
  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = useCallback(
    async (text: string) => {
      clearTimeout(timer.current)
      let ok = false
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text)
          ok = true
        }
      } catch {
        ok = false
      }
      setState(ok ? 'copied' : 'failed')
      timer.current = setTimeout(() => setState('idle'), resetAfterMs)
      return ok
    },
    [resetAfterMs],
  )

  return { state, copy }
}
