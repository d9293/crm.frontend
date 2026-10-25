/** Theme context object, types and hook. Split from the provider component
 *  so fast refresh works — see the note in `auth/context.ts`. */

import { createContext, useContext } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'

export interface ThemeState {
  preference: ThemePreference
  setPreference: (preference: ThemePreference) => void
}

export const ThemeContext = createContext<ThemeState | null>(null)

export function useTheme(): ThemeState {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used inside a ThemeProvider')
  }
  return context
}
