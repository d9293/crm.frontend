/**
 * Coach shell — `development/ui-ux.md` section 2.
 *
 * Centred on upcoming sessions and rosters. The earnings destination appears
 * only with an explicit finance grant, so a coach without one never sees a
 * link to amounts they may not view.
 */

import { NavLink, Outlet } from 'react-router'
import { useAuth } from '../auth/context'
import { COACH_NAVIGATION } from './navigation'
import { NotificationsLink, SignOutButton, ThemeSelect } from './HeaderControls'
import './shells.css'

export default function CoachShell() {
  const { user, canAny } = useAuth()
  const items = COACH_NAVIGATION.filter((item) => canAny(...item.anyOf))

  return (
    <div className="shell shell--coach">
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
        <NotificationsLink />
        <ThemeSelect />
        <SignOutButton />
      </header>

      <main className="shell__main" id="main">
        <Outlet />
      </main>
    </div>
  )
}
