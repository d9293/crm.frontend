/**
 * Staff shell — `development/ui-ux.md` section 2.
 *
 * Desktop left rail at 232px with the four navigation groups in specification
 * order. Header carries the location selector, notifications and account
 * controls. Only authorized destinations render; a group with no permitted
 * items is omitted entirely rather than left as an empty heading.
 *
 * Permission scope is never conveyed by a theme colour, so there is no
 * role-tinted chrome here.
 */

import { Link, NavLink, Outlet } from 'react-router'
import { useAuth } from '../auth/context'
import { STAFF_NAVIGATION, type NavGroup } from './navigation'
import {
  LocationSelect,
  NotificationsLink,
  SignOutButton,
  ThemeSelect,
} from './HeaderControls'
import './shells.css'

const ROLE_LABELS: Record<string, string> = {
  power_user: 'Полные права',
  administrator: 'Администратор',
  operator: 'Оператор',
  coach: 'Тренер',
  customer: 'Клиент',
}

export default function StaffShell() {
  const { user, canAny } = useAuth()

  const visibleGroups: NavGroup[] = STAFF_NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter((item) => canAny(...item.anyOf)),
  })).filter((group) => group.items.length > 0)

  return (
    <div className="shell shell--staff">
      <a className="crm-skip-link" href="#main">
        Перейти к содержимому
      </a>

      <div className="shell__rail">
        <Link className="shell__wordmark" to="/staff/schedule">
          ACE / CSKA CRM
        </Link>

        <nav className="shell__nav" aria-label="Основная навигация">
          {visibleGroups.map((group) => (
            <div className="shell__nav-group" key={group.label}>
              <div className="shell__nav-group-label">{group.label}</div>
              <ul className="shell__nav-list">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink className="shell__nav-link" to={item.to}>
                      {item.label}
                      {/*
                        Active-count badges are intentionally absent until the
                        queue endpoints exist. Rendering a zero would assert
                        there is nothing to approve, which is a claim this
                        shell cannot yet make. Wired in FE-10 and FE-11.
                      */}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="shell__rail-footer">
          <span className="shell__identity">{user?.full_name}</span>
          <span className="crm-meta">
            {user ? (ROLE_LABELS[user.role] ?? user.role) : null}
          </span>
        </div>
      </div>

      <header className="shell__header">
        <LocationSelect />
        <span className="shell__header-spacer" />
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
