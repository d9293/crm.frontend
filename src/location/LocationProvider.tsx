/**
 * Selected location (ACE or CSKA) for location-scoped staff views.
 *
 * Two requirements shape this, both from `development/ui-ux.md` section 2 and
 * UX-05:
 *
 *  - A permitted location preference may be remembered, but data from the
 *    previous location must never be silently retained. Switching location
 *    must not leave a stale court, summary or queue masquerading as the new
 *    location, so every switch changes `scopeKey`.
 *  - There is no "all locations" option on a resource calendar.
 *
 * `scopeKey` is the value consumers key caches and queries on. Partitioning by
 * it satisfies the `frontend.md` requirement that query state be partitioned
 * by authenticated user and location, and that protected caches clear on scope
 * change.
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/context'
import { SelectedLocationContext, type LocationState } from './context'

const STORAGE_KEY = 'crm.location'

function readStoredLocationId(): number | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const parsed = Number(stored)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
  } catch {
    return null
  }
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const { user, locations } = useAuth()
  const [selectedId, setSelectedId] = useState<number | null>(readStoredLocationId)

  // Resolve against the locations the server actually permits. A remembered
  // preference must never grant access: if the stored location is no longer
  // permitted, it is discarded rather than honoured.
  const selected = useMemo(() => {
    if (locations.length === 0) return null
    return locations.find((location) => location.id === selectedId) ?? locations[0]
  }, [locations, selectedId])

  useEffect(() => {
    if (!selected) return
    try {
      localStorage.setItem(STORAGE_KEY, String(selected.id))
    } catch {
      // Preference persistence is optional.
    }
  }, [selected])

  const select = useCallback((locationId: number) => {
    setSelectedId(locationId)
  }, [])

  const value = useMemo<LocationState>(
    () => ({
      selected,
      available: locations,
      select,
      scopeKey: `${user?.id ?? 'anonymous'}:${selected?.id ?? 'none'}`,
    }),
    [selected, locations, select, user?.id],
  )

  return (
    <SelectedLocationContext.Provider value={value}>
      {children}
    </SelectedLocationContext.Provider>
  )
}
