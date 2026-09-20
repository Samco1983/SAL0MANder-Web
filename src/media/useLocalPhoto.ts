import { useCallback, useEffect, useRef, useState } from 'react'
import { prepareCustomPhoto, type PreparedCustomPhoto } from '@/gifts/customPhoto'

/** Device memory only: no storage provider, upload, draft persistence or approval. */
export function useLocalPhoto() {
  const [photo, setPhoto] = useState<PreparedCustomPhoto | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState('')
  const [revision, setRevision] = useState(0)
  const pending = useRef<AbortController | null>(null)
  useEffect(() => () => pending.current?.abort(), [])

  const clear = useCallback(() => {
    pending.current?.abort()
    pending.current = null
    setPhoto(null)
    setPreparing(false)
    setError('')
    setRevision((value) => value + 1)
  }, [])

  async function choose(file: File) {
    clear()
    const controller = new AbortController()
    pending.current = controller
    setPreparing(true)
    try {
      const prepared = await prepareCustomPhoto(file, controller.signal)
      if (!controller.signal.aborted && pending.current === controller) setPhoto(prepared)
    } catch (cause) {
      if (!controller.signal.aborted && pending.current === controller)
        setError(cause instanceof Error ? cause.message : 'This photo could not be opened.')
    } finally {
      if (!controller.signal.aborted && pending.current === controller) setPreparing(false)
    }
  }
  return { photo, preparing, error, revision, choose, clear }
}
export type LocalPhotoState = ReturnType<typeof useLocalPhoto>
