/**
 * Auth context object, types and hook.
 *
 * Separate from the provider component so each file exports only components or
 * only non-components. Mixing the two breaks Vite's fast refresh for that file,
 * which is what the `react(only-export-components)` lint rule flags.
 */

import { createContext, useContext } from 'react'
import type { Capability, CurrentUser, LocationSummary } from '../api/types'

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous'

export interface AuthState {
  status: AuthStatus
  user: CurrentUser | null

  /** True when the user holds every listed capability. */
  can: (...required: Capability[]) => boolean
  /** True when the user holds at least one listed capability. */
  canAny: (...required: Capability[]) => boolean
  /** True when the location is among those the server permits. */
  hasLocation: (locationId: number) => boolean

  locations: LocationSummary[]
  setUser: (user: CurrentUser | null) => void
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider')
  }
  return context
}
