import { Button } from '@components/ui/Button'
import type { GiftFeedbackSettings } from './useGiftFeedback'
import type { GiftTextSize } from '@/gifts/giftFeedback'
import styles from './GiftFeedbackControls.module.css'

export function GiftFeedbackControls({ feedback }: { feedback: GiftFeedbackSettings }) {
  return (
    <div className={styles.controls} role="group" aria-label="Gift effects and text">
      <Button
        type="button"
        variant="secondary"
        aria-pressed={feedback.sound}
        onClick={() => feedback.setSound(!feedback.sound)}
      >
        Gift sounds {feedback.sound ? 'on' : 'off'}
      </Button>
      <Button
        type="button"
        variant="secondary"
        disabled={!feedback.vibrationAvailable}
        aria-pressed={feedback.vibrationAvailable && feedback.vibration}
        onClick={() => feedback.setVibration(!feedback.vibration)}
      >
        {feedback.vibrationAvailable
          ? `Vibration ${feedback.vibration ? 'on' : 'off'}`
          : 'Vibration unavailable'}
      </Button>
      <label>
        Gift text{' '}
        <select
          aria-label="Gift text size"
          value={feedback.textSize}
          onChange={(event) => feedback.setTextSize(event.target.value as GiftTextSize)}
        >
          <option value="smallest">Smallest · 64%</option>
          <option value="smaller">Smaller · 76%</option>
          <option value="compact">Small · 88%</option>
          <option value="normal">Normal · 100%</option>
          <option value="large">Large · 112%</option>
        </select>
      </label>
    </div>
  )
}
