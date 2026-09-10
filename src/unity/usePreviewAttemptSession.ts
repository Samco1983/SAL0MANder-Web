import { useEffect, useRef, useState, type RefObject } from 'react'
import type { UnityMessageTarget } from './bridge'
import { onPreviewMessage, sendPreview, type PreviewBoot } from './previewBridge'
import { onPreviewAttemptMessage } from './previewAttemptBridge'

/** Gifts require replay-aware acknowledgement; legacy Teacher Studio never opts into this. */
export function usePreviewAttemptSession(
  preview: PreviewBoot | undefined,
  instance: RefObject<UnityMessageTarget | null>,
  runtimeReady: boolean,
  retryToken: number,
) {
  const [status, setStatus] = useState<'pending' | 'ready' | 'error'>('pending')
  const [message, setMessage] = useState('')
  const [handshake, setHandshake] = useState(0)
  const capable = useRef(false)
  const sent = useRef(false)
  const terminal = useRef(false)
  const currentAttempt = useRef(0)
  useEffect(() => {
    if (!preview) return
    capable.current = false
    sent.current = false
    terminal.current = false
    currentAttempt.current = 0
    setStatus('pending')
    setMessage('')
    const stopAttempts = onPreviewAttemptMessage((event) => {
      if (terminal.current) return
      if (event.type === 'preview-attempt-receiver-ready') {
        capable.current = true
        setHandshake((value) => value + 1)
      } else if (
        sent.current &&
        event.requestId === preview.requestId &&
        event.type === 'preview-attempt-ready' &&
        event.attempt >= currentAttempt.current
      ) {
        currentAttempt.current = event.attempt
        setStatus('ready')
      }
    })
    const stopErrors = onPreviewMessage((event) => {
      if (terminal.current || !sent.current || event.requestId !== preview.requestId) return
      if (event.type === 'preview-error') {
        terminal.current = true
        setMessage(event.message || 'The game could not open this gift.')
        setStatus('error')
      }
    })
    return () => {
      terminal.current = true
      stopAttempts()
      stopErrors()
    }
  }, [preview, retryToken])

  useEffect(() => {
    if (!preview || !runtimeReady || !capable.current || sent.current || terminal.current) return
    sent.current = true // Unity may synchronously acknowledge SendMessage.
    if (!sendPreview(instance.current, preview)) sent.current = false
  }, [preview, instance, runtimeReady, handshake, retryToken])

  useEffect(() => {
    if (!preview || !runtimeReady || status !== 'pending') return
    const retry = () => {
      if (!capable.current || terminal.current) return
      sent.current = true
      if (!sendPreview(instance.current, preview)) sent.current = false
    }
    const timers = [2000, 5000].map((delay) => setTimeout(retry, delay))
    timers.push(
      setTimeout(() => {
        terminal.current = true
        setMessage('This game build cannot open this gift. Try again with the current game build.')
        setStatus('error')
      }, 20000),
    )
    return () => timers.forEach(clearTimeout)
  }, [preview, instance, runtimeReady, status, retryToken])
  return { status, message }
}
