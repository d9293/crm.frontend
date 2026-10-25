/**
 * HoldTimer — `ui-ux.md` section 9 and the customer journey in section 5.
 *
 * Displays the remaining time on a five-minute reservation hold. The rules
 * here are correctness rules, not presentation preferences:
 *
 *  1. **The browser clock is never trusted.** Remaining time is derived from
 *     the server's `server_time` and `hold_expires_at`, with elapsed time
 *     measured by a monotonic `performance.now()` delta. A device whose clock
 *     is wrong — or deliberately changed — cannot appear to extend or shorten
 *     a hold (FE-07 acceptance).
 *  2. **Reaching zero locally proves nothing.** At zero the component enters
 *     `checking` and asks the caller to refresh from the server. It must never
 *     render a confirmed, expired or cancelled outcome on its own authority.
 *     Only the server decides whether a hold is still live.
 *  3. **No per-second announcements.** Section 11 forbids announcing a ticking
 *     timer every second; the live region carries only a stable sentence.
 *
 * `performance.now()` matters: `Date.now()` can jump if the OS clock is
 * adjusted mid-hold (NTP correction, manual change, VM resume), which would
 * silently add or remove time from the countdown.
 */

import { useEffect, useState } from 'react'
import { formatCountdown, formatTime, type Instant } from '../lib/format'
import './components.css'

export type HoldPhase = 'active' | 'checking' | 'expired' | 'offline'

interface HoldTimerProps {
  /** `hold_expires_at` from the server. */
  expiresAt: Instant
  /** `server_time` from the same response — the anchor for elapsed time. */
  serverTime: Instant
  /**
   * Called once when the local countdown reaches zero, so the caller can
   * reconcile with the server. The component shows `checking` until the caller
   * supplies fresh state.
   */
  onExpiryReached?: () => void
  /** Set when the server has confirmed the hold is gone. */
  serverExpired?: boolean
  /** Set when connectivity is lost; a local timer is not a valid booking. */
  offline?: boolean
}

/**
 * Re-anchors by remounting.
 *
 * A fresh server response means a fresh countdown. Keying the inner component
 * on the server values gives it new initial state automatically, instead of
 * resetting state from inside an effect — which would start a cascading
 * render and leave the previous value visible for one frame.
 */
export function HoldTimer(props: HoldTimerProps) {
  return <HoldTimerCountdown key={`${props.expiresAt}|${props.serverTime}`} {...props} />
}

function HoldTimerCountdown({
  expiresAt,
  serverTime,
  onExpiryReached,
  serverExpired = false,
  offline = false,
}: HoldTimerProps) {
  const totalSeconds = Math.max(
    0,
    Math.floor((new Date(expiresAt).getTime() - new Date(serverTime).getTime()) / 1000),
  )

  const [elapsed, setElapsed] = useState(0)
  const paused = serverExpired || offline

  // The clock is an external system, which is what an effect is for. The
  // monotonic anchor is captured here rather than during render, so rendering
  // stays pure.
  useEffect(() => {
    if (paused) return

    const anchor = performance.now()
    let notified = false

    const id = setInterval(() => {
      const seconds = Math.floor((performance.now() - anchor) / 1000)
      setElapsed(seconds)

      if (seconds >= totalSeconds && !notified) {
        notified = true
        onExpiryReached?.()
      }
    }, 1000)

    return () => clearInterval(id)
  }, [paused, totalSeconds, onExpiryReached])

  const remaining = Math.max(0, totalSeconds - elapsed)

  const phase: HoldPhase = serverExpired
    ? 'expired'
    : offline
      ? 'offline'
      : remaining === 0
        ? 'checking'
        : 'active'

  return (
    <div className={`hold-timer hold-timer--${phase}`}>
      {phase === 'active' && (
        <>
          <span className="hold-timer__value crm-numeric" aria-hidden="true">
            {formatCountdown(remaining)}
          </span>
          <span className="hold-timer__text">
            Время удерживается до {formatTime(expiresAt)}
          </span>
          {/*
            The visible digits are aria-hidden and this region carries a stable
            sentence instead, so a screen reader is not interrupted every
            second. The exact deadline is more useful than a ticking number.
          */}
          <span className="crm-visually-hidden" role="status">
            Заявка отправлена. Время удерживается до {formatTime(expiresAt)}.
          </span>
        </>
      )}

      {phase === 'checking' && (
        <span className="hold-timer__text" role="status">
          Проверяем статус заявки…
        </span>
      )}

      {phase === 'expired' && (
        <span className="hold-timer__text" role="status">
          Время ожидания истекло. Бронь не подтверждена.
        </span>
      )}

      {phase === 'offline' && (
        <span className="hold-timer__text" role="status">
          Нет соединения. Проверим статус после подключения.
        </span>
      )}
    </div>
  )
}
