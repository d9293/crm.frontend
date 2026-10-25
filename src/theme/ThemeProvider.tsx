/**
 * Theme preference: light, dark, or follow the operating system.
 *
 * Writes `data-theme` on the document root when the user chooses explicitly,
 * and removes it for `system` so the `prefers-color-scheme` block in
 * tokens.css takes over. All three states must work — see the comment at the
 * top of tokens.css.
 *
 * The preference is a harmless display setting, so `localStorage` is
 * appropriate. Business and financial state never goes there: PostgreSQL is
 * the authoritative store, and browser storage is only for preferences and
 * transient drafts (`development/README.md` section 3).
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ThemeContext, type ThemePreference, type ThemeState } from './context'

const STORAGE_KEY = 'crm.theme'

function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored
    }
  } catch {
    // Storage can be unavailable in private modes or with storage disabled.
    // Falling back to `system` is correct and needs no user-facing error.
  }
  return 'system'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readStoredPreference)

  useEffect(() => {
    const root = document.documentElement

    if (preference === 'system') {
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', preference)
    }

    try {
      localStorage.setItem(STORAGE_KEY, preference)
    } catch {
      // A preference that cannot be persisted still applies for this session.
    }
  }, [preference])

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next)
  }, [])

  const value = useMemo<ThemeState>(
    () => ({ preference, setPreference }),
    [preference, setPreference],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
