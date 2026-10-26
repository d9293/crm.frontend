/**
 * P07 step A — choose a slot. `ui-ux.md` section 5.
 *
 * Pure and prop-driven, so FE-07 can wire it to `GET /availability` without
 * rewriting it, and the design prototype can drive it from a simulation.
 *
 * Three rules it enforces:
 *
 *  - **Selecting creates no hold.** Choosing a slot highlights it and nothing
 *    more. The hold begins only when the server accepts the request.
 *  - **Occupied slots disclose nothing.** `ResourceSlot` renders them as
 *    unavailable with no customer, group or booking reference.
 *  - **Durations come from the server.** The client does not invent intervals;
 *    the permitted list is returned with availability. GATE D-06.
 */

import type { AvailabilityResponse, Id } from '../../api/types'
import { ResourceSlot } from '../../components/ResourceSlot'
import { formatDate } from '../../lib/format'
import './booking.css'

export interface SlotSelection {
  resourceId: Id
  startsAt: string
  endsAt: string
}

interface AvailabilityPickerProps {
  availability: AvailabilityResponse
  durationMinutes: number
  onDurationChange: (minutes: number) => void
  date: string
  onDateChange: (date: string) => void
  selected: SlotSelection | null
  onSelect: (selection: SlotSelection) => void
}

export function AvailabilityPicker({
  availability,
  durationMinutes,
  onDurationChange,
  date,
  onDateChange,
  selected,
  onSelect,
}: AvailabilityPickerProps) {
  return (
    <div>
      <div className="booking__toolbar">
        <label className="shell__field">
          <span className="shell__field-label">Дата</span>
          <input
            className="shell__control"
            style={{ cursor: 'text' }}
            type="date"
            value={date}
            onChange={(event) => onDateChange(event.target.value)}
          />
        </label>

        <label className="shell__field">
          <span className="shell__field-label">Длительность</span>
          <select
            className="shell__control"
            value={durationMinutes}
            onChange={(event) => onDurationChange(Number(event.target.value))}
          >
            {availability.durations
              .filter((option) => option.is_allowed)
              .map((option) => (
                <option key={option.minutes} value={option.minutes}>
                  {option.minutes} минут
                </option>
              ))}
          </select>
        </label>
      </div>

      {/* The chosen date is restated in words, so the selection stays
          unambiguous once the user has scrolled down to the slots. Midday is
          used as the instant so no timezone conversion can shift the date. */}
      <p className="crm-meta" style={{ marginBottom: 'var(--crm-space-4)' }}>
        Свободное время на {formatDate(`${date}T12:00:00Z`)}
      </p>

      {availability.resources.map((resource) => {
        const slots = availability.slots.filter((slot) => slot.resource_id === resource.id)
        const freeCount = slots.filter((slot) => slot.is_available).length

        return (
          <section className="booking__court" key={resource.id}>
            <h3 className="booking__court-name">
              {resource.name}
              <span className="crm-meta">
                {resource.placement === 'indoor' ? 'в зале' : 'на улице'} · свободно{' '}
                {freeCount}
              </span>
            </h3>

            {freeCount === 0 ? (
              <p className="crm-muted">
                На выбранную дату и длительность свободного времени нет.
              </p>
            ) : (
              <div className="booking__slots">
                {slots
                  .filter((slot) => slot.is_available || slot.unavailable_reason === 'occupied')
                  .map((slot) => {
                    const isSelected =
                      selected?.resourceId === resource.id &&
                      selected.startsAt === slot.starts_at

                    return (
                      <ResourceSlot
                        key={`${resource.id}-${slot.starts_at}`}
                        resourceName={resource.name}
                        startsAt={slot.starts_at}
                        endsAt={slot.ends_at}
                        state={
                          !slot.is_available
                            ? 'unavailable'
                            : isSelected
                              ? 'selected'
                              : 'free'
                        }
                        onSelect={() =>
                          onSelect({
                            resourceId: resource.id,
                            startsAt: slot.starts_at,
                            endsAt: slot.ends_at,
                          })
                        }
                      />
                    )
                  })}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
