import { useEffect, useState } from 'react'
import { LearningOffers } from '@components/learning/LearningOffers'
import { onSlideMessage } from '@unity/slideBridge'

/** Only the current native attempt can reveal the optional completion links. */
export function SlideLearningOffer({ requestId }: { requestId: string }) {
  const [finishedRequest, setFinishedRequest] = useState<string | null>(null)
  useEffect(() => {
    let attempt = 0
    let stopped = false
    return onSlideMessage((message) => {
      if (message.requestId !== requestId || stopped) return
      if (message.type === 'slide-ready' && message.attempt > attempt) {
        attempt = message.attempt
        setFinishedRequest(null)
      } else if (message.type === 'slide-finished' && attempt > 0 && message.attempt === attempt) {
        setFinishedRequest(requestId)
      } else if (message.type === 'slide-cancelled' || message.type === 'slide-error') {
        stopped = true
        setFinishedRequest(null)
      }
    })
  }, [requestId])
  return finishedRequest === requestId ? <LearningOffers compact /> : null
}
