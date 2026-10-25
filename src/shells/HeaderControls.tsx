/**
 * Shared header controls: location selector, notifications entry, theme and
 * sign out.
 *
 * The location selector is the minimal form needed by the shells. The full
 * `LocationSwitcher` component contract — loading, single-location and
 * unavailable variants — is FE-00b.
 */

import { Link } from 'react-router'
import { useAuth } from '../auth/context'
import { useSelectedLocation } from '../location/context'
import { useTheme, type ThemePreference } from '../theme/context'

/**
 * Location selector. Rendered only when the user has a permitted location.
 *
 * There is deliberately no "all locations" option: section 2 forbids it on a
 * resource calendar, and an aggregate option here would leak into every
 * location-scoped view beneath it.
 */
export function LocationSelect() {
  const { selected, available, select } = useSelectedLocation()

  if (!selected || available.length === 0) {
    return null
  }

  // A single permitted location is shown as text: a select with one option
  // invites a choice that does not exist.
  if (available.length === 1) {
    return (
      <span className="shell__field">
        <span className="shell__field-label">Локация</span>
        <strong>{selected.name}</strong>
      </span>
    )
  }

  return (
    <label className="shell__field">
      <span className="shell__field-label">Локация</span>
      <select
        className="shell__control"
        value={selected.id}
        onChange={(event) => select(Number(event.target.value))}
      >
        {available.map((location) => (
          <option key={location.id} value={location.id}>
            {location.name}
          </option>
        ))}
      </select>
    </label>
  )
}

const THEME_LABELS: Record<ThemePreference, string> = {
  system: 'Как в системе',
  light: 'Светлая',
  dark: 'Тёмная',
}

export function ThemeSelect() {
  const { preference, setPreference } = useTheme()

  return (
    <label className="shell__field">
      <span className="shell__field-label">Тема</span>
      <select
        className="shell__control"
        value={preference}
        onChange={(event) => setPreference(event.target.value as ThemePreference)}
      >
        {(Object.keys(THEME_LABELS) as ThemePreference[]).map((value) => (
          <option key={value} value={value}>
            {THEME_LABELS[value]}
          </option>
        ))}
      </select>
    </label>
  )
}

export function NotificationsLink() {
  return (
    <Link className="shell__tab" to="/notifications">
      Уведомления
    </Link>
  )
}

/**
 * Sign out.
 *
 * Clears the user from context, which drops every location-scoped cache keyed
 * on `scopeKey`. The session itself is revoked server-side by
 * `DELETE /session` once the API client lands in FE-00b — there is no local
 * credential to clear, since the session cookie is `HttpOnly`.
 */
export function SignOutButton() {
  const { setUser } = useAuth()

  return (
    <button type="button" className="shell__control" onClick={() => setUser(null)}>
      Выйти
    </button>
  )
}
