import { useEffect, useRef, useState, type RefObject } from 'react'
import type { UnityMessageTarget } from './bridge'
import { onSlideMessage, sendSlideBoot, type SlideBoot } from './slideBridge'

/** Capability and current-request acknowledgement both precede visible gameplay. */
export function useSlideSession(
  slide: SlideBoot | undefined,
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
    if (!slide) return
    capable.current = false
    sent.current = false
    terminal.current = false
    currentAttempt.current = 0
    setStatus('pending')
    setMessage('')
    const stop = onSlideMessage((event) => {
      if (terminal.current) return
      if (event.type === 'slide-receiver-ready') {
        capable.current = true
        setHandshake((value) => value + 1)
        return
      }
      if (event.requestId !== slide.requestId || !sent.current) return
      if (event.type === 'slide-ready' && event.attempt >= currentAttempt.current) {
        currentAttempt.current = event.attempt
        setStatus('ready')
      } else if (event.type === 'slide-error' || event.type === 'slide-cancelled') {
        terminal.current = true
        setMessage(
          event.type === 'slide-error'
            ? event.message
            : 'This puzzle was closed. Open it again to play.',
        )
        setStatus('error')
      }
    })
    return () => {
      terminal.current = true
      stop()
    }
  }, [slide, retryToken])

  useEffect(() => {
    if (!slide || !runtimeReady || !capable.current || sent.current || terminal.current) return
    // Unity can synchronously acknowledge SendMessage, so mark before sending.
    sent.current = true
    if (!sendSlideBoot(instance.current, slide)) sent.current = false
  }, [slide, instance, runtimeReady, handshake, retryToken])

  useEffect(() => {
    if (!slide || !runtimeReady || status !== 'pending') return
    const retry = () => {
      if (!capable.current || terminal.current) return
      sent.current = true
      if (!sendSlideBoot(instance.current, slide)) sent.current = false
    }
    const timers = [2000, 5000].map((delay) => setTimeout(retry, delay))
    timers.push(
      setTimeout(() => {
        terminal.current = true
        setMessage(
          'This game build could not open Slide & Solve. Try again with the current game build.',
        )
        setStatus('error')
      }, 20000),
    )
    return () => timers.forEach(clearTimeout)
  }, [slide, instance, runtimeReady, status, retryToken])
  return { status, message }
}
