/**
 * ResourceSlot — `ui-ux.md` section 9.
 *
 * One bookable interval on one court. Constraints:
 *
 *  - **No other customer's data, ever.** An occupied slot is rendered as
 *    unavailable with no name, group or booking detail. `README.md` section 7
 *    requires that customers never see another customer's identity in
 *    availability responses, and this is the component where a careless
 *    `title` attribute would leak it.
 *  - **A keyboard equivalent is mandatory.** Section 11 requires keyboard
 *    alternatives for timetable selection, so this is a real `<button>` rather
 *    than a click-handling div.
 *  - **Selecting creates no hold.** Section 5 step A: choosing a slot
 *    highlights it and nothing more. The hold begins only when the server
 *    accepts the request.
 */

import { formatTime, type Instant } from '../lib/format'
import './components.css'

export type SlotState = 'free' | 'selected' | 'held' | 'unavailable' | 'closed'

interface ResourceSlotProps {
  startsAt: Instant
  /** Exclusive. Half-open `[start, end)`, so 11:00 abuts 10:00–11:00. */
  endsAt: Instant
  state: SlotState
  resourceName: string
  onSelect?: () => void
}

const STATE_TEXT: Record<SlotState, string> = {
  free: 'Свободно',
  selected: 'Выбрано',
  // Deliberately vague for the customer view: that someone holds this slot is
  // all a customer may know.
  held: 'Недоступно',
  unavailable: 'Занято',
  closed: 'Закрыто',
}

export function ResourceSlot({
  startsAt,
  endsAt,
  state,
  resourceName,
  onSelect,
}: ResourceSlotProps) {
  const selectable = state === 'free' || state === 'selected'
  const interval = `${formatTime(startsAt)}–${formatTime(endsAt)}`

  return (
    <button
      type="button"
      className={`slot slot--${state}`}
      disabled={!selectable}
      aria-pressed={state === 'selected'}
      // The accessible name carries court, time and status, so the state is
      // never conveyed by colour alone.
      aria-label={`${resourceName}, ${interval}, ${STATE_TEXT[state]}`}
      onClick={selectable ? onSelect : undefined}
    >
      <span className="slot__time crm-numeric">{interval}</span>
      <span className="slot__state">{STATE_TEXT[state]}</span>
    </button>
  )
}
