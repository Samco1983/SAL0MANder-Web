import { useCallback, useEffect, useRef, useState } from 'react'
import { SOUND_LIBRARY, getPictureSound } from '@content/soundLibrary'
import {
  GiftFeedback,
  GIFT_SOUND_KEY,
  GIFT_VIBRATION_KEY,
  GIFT_TEXT_KEY,
  readGiftTextSize,
  type GiftTextSize,
} from '@/gifts/giftFeedback'
import type { GiftPresentation } from '@/gifts/giftPresentation'

function saved(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* Controls still work for this visit. */
  }
}

export function useGiftFeedback() {
  const [sound, updateSound] = useState(() => saved(GIFT_SOUND_KEY) !== 'off')
  const [vibration, updateVibration] = useState(() => saved(GIFT_VIBRATION_KEY) !== 'off')
  const [textSize, updateTextSize] = useState<GiftTextSize>(() => {
    const value = saved(GIFT_TEXT_KEY)
    return readGiftTextSize(value)
  })
  const preferences = useRef({ sound, vibration })
  const engine = useRef<GiftFeedback | null>(null)
  const generation = useRef(0)
  const rewardGeneration = useRef<number | null>(null)
  const rewardFinished = useRef<Promise<boolean>>(Promise.resolve(false))
  const vibrationAvailable = typeof navigator.vibrate === 'function'
  const getEngine = useCallback(() => {
    if (!engine.current) {
      engine.current = new GiftFeedback()
      engine.current.setSound(preferences.current.sound)
      engine.current.setVibration(preferences.current.vibration)
    }
    return engine.current
  }, [])
  const stop = useCallback(() => {
    generation.current++
    rewardGeneration.current = null
    engine.current?.stop()
  }, [])
  useEffect(
    () => () => {
      generation.current++
      engine.current?.dispose()
      engine.current = null
    },
    [],
  )
  const unlock = useCallback(() => {
    getEngine().unlock()
  }, [getEngine])
  const setSound = useCallback(
    (on: boolean) => {
      generation.current++
      preferences.current.sound = on
      updateSound(on)
      save(GIFT_SOUND_KEY, on ? 'on' : 'off')
      getEngine().setSound(on)
      if (on) getEngine().unlock()
    },
    [getEngine],
  )
  const setVibration = useCallback(
    (on: boolean) => {
      preferences.current.vibration = on
      updateVibration(on)
      save(GIFT_VIBRATION_KEY, on ? 'on' : 'off')
      getEngine().setVibration(on)
    },
    [getEngine],
  )
  const setTextSize = useCallback((value: GiftTextSize) => {
    const next = readGiftTextSize(value)
    updateTextSize(next)
    save(GIFT_TEXT_KEY, next)
  }, [])
  const opening = useCallback(
    (wrapper: GiftPresentation['wrapper']) => {
      stop()
      const current = getEngine()
      current.unlock()
      current.pulse(18)
      void current.play(
        SOUND_LIBRARY.find(
          (item) => item.key === (wrapper === 'box' ? 'gift_box_pop' : 'gift_envelope_unfold'),
        ),
      )
    },
    [getEngine, stop],
  )
  const complete = useCallback(
    (effect: GiftPresentation['celebration']) => {
      stop()
      const current = getEngine()
      current.pulse([25, 55, 30, 75, 45])
      rewardGeneration.current = generation.current
      rewardFinished.current = current.play(
        SOUND_LIBRARY.find(
          (item) => item.key === (effect === 'hearts' ? 'heart_bloom' : 'victory_warm_magic'),
        ),
      )
    },
    [getEngine, stop],
  )
  const pictureVisible = useCallback((key: string) => {
    const current = generation.current
    const pictureSound = getPictureSound(key)
    if (!pictureSound || !preferences.current.sound || rewardGeneration.current !== current) return
    void rewardFinished.current.then(() => {
      if (current === generation.current && preferences.current.sound)
        void engine.current?.play(pictureSound)
    })
  }, [])
  return {
    sound,
    vibration,
    vibrationAvailable,
    textSize,
    setSound,
    setVibration,
    setTextSize,
    unlock,
    opening,
    complete,
    pictureVisible,
    stop,
  }
}
export type GiftFeedbackSettings = ReturnType<typeof useGiftFeedback>
