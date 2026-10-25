/**
 * Authenticated session state.
 *
 * Holds the `CurrentUser` from `GET /me` and derives capability and location
 * checks from it. Deliberately limited to that: this is not a permission
 * engine. The server decides every call, and `frontend.md` is explicit that
 * UI hiding is not enforcement — these helpers only decide what is worth
 * rendering.
 *
 * No credential is stored here or anywhere else reachable from JavaScript. The
 * session lives in a `Secure`, `HttpOnly` cookie, so there is nothing to keep.
 */

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import type { CurrentUser } from '../api/types'
import { AuthContext, type AuthState, type AuthStatus } from './context'

interface AuthProviderProps {
  children: ReactNode
  /**
   * Initial user, for tests and the FE-00b fixture harness. Production
   * resolves this from `GET /me` once the API client lands.
   */
  initialUser?: CurrentUser | null
  initialStatus?: AuthStatus
}

export function AuthProvider({
  children,
  initialUser = null,
  initialStatus,
}: AuthProviderProps) {
  const [user, setUserState] = useState<CurrentUser | null>(initialUser)
  const [status, setStatus] = useState<AuthStatus>(
    initialStatus ?? (initialUser ? 'authenticated' : 'loading'),
  )

  const setUser = useCallback((next: CurrentUser | null) => {
    setUserState(next)
    setStatus(next ? 'authenticated' : 'anonymous')
  }, [])

  const value = useMemo<AuthState>(() => {
    const granted = new Set<string>(user?.capabilities ?? [])
    const locations = user?.locations ?? []
    const locationIds = new Set(locations.map((location) => location.id))

    return {
      status,
      user,
      locations,
      setUser,
      can: (...required) => required.every((capability) => granted.has(capability)),
      canAny: (...required) => required.some((capability) => granted.has(capability)),
      hasLocation: (locationId) => locationIds.has(locationId),
    }
  }, [status, user, setUser])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
