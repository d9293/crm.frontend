/**
 * Customer shell — `development/ui-ux.md` section 2.
 *
 * Two primary destinations only: book a court, and my reservations. Account
 * and sign out live in the header rather than an invented customer dashboard.
 * Membership and payment-profile pages are deferred under D-03 and must not
 * appear here as disabled teasers.
 *
 * On phones the two destinations become a labelled bottom navigation, and the
 * content carries bottom safe-area padding.
 */

import { NavLink, Outlet } from 'react-router'
import { useAuth } from '../auth/context'
import { CUSTOMER_NAVIGATION } from './navigation'
import { SignOutButton, ThemeSelect } from './HeaderControls'
import './shells.css'

export default function CustomerShell() {
  const { user, canAny } = useAuth()
  const items = CUSTOMER_NAVIGATION.filter((item) => canAny(...item.anyOf))

  return (
    <div className="shell shell--customer">
      <a className="crm-skip-link" href="#main">
        Перейти к содержимому
      </a>

      <header className="shell__header">
        <strong>ACE / CSKA</strong>

        <nav className="shell__tabs" aria-label="Основная навигация">
          {items.map((item) => (
            <NavLink key={item.to} className="shell__tab" to={item.to}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <span className="shell__header-spacer" />
        <span className="crm-meta">{user?.full_name}</span>
        <ThemeSelect />
        <SignOutButton />
      </header>

      <main className="shell__main" id="main">
        <Outlet />
      </main>

      <nav className="shell__bottom-nav" aria-label="Основная навигация">
        {items.map((item) => (
          <NavLink key={item.to} className="shell__tab" to={item.to}>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
