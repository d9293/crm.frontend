/** Selected-location context object, types and hook. Split from the provider
 *  component so fast refresh works — see the note in `auth/context.ts`. */

import { createContext, useContext } from 'react'
import type { LocationSummary } from '../api/types'

export interface LocationState {
  /** Null while the user has no permitted locations, or before resolution. */
  selected: LocationSummary | null
  available: LocationSummary[]
  select: (locationId: number) => void
  /**
   * Cache partition key: `<userId>:<locationId>`. Changes on sign-in, user
   * switch and location switch, so nothing survives a scope change.
   */
  scopeKey: string
}

export const SelectedLocationContext = createContext<LocationState | null>(null)

export function useSelectedLocation(): LocationState {
  const context = useContext(SelectedLocationContext)
  if (!context) {
    throw new Error('useSelectedLocation must be used inside a LocationProvider')
  }
  return context
}
