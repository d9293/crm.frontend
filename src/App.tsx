/**
 * Application root: provider composition and routing.
 *
 * Provider order matters. `LocationProvider` resolves the selected location
 * against the locations the server permits, so it must sit inside
 * `AuthProvider`.
 *
 * `initialStatus` is `anonymous` because there is no session endpoint yet.
 * FE-01 replaces this with a `GET /session` call and keeps `loading` until it
 * resolves, so a refresh restores a valid session instead of bouncing the
 * user to sign-in.
 */

import { BrowserRouter } from 'react-router'
import { AuthProvider } from './auth/AuthProvider'
import { LocationProvider } from './location/LocationProvider'
import { ThemeProvider } from './theme/ThemeProvider'
import AppRoutes from './routes/AppRoutes'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider initialStatus="anonymous">
        <LocationProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </LocationProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
