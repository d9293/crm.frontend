/**
 * Route guards.
 *
 * These decide what is worth rendering. They are not access control: the
 * server enforces authorization on every read, write and export, and a user
 * who reaches a route by typing its URL receives a denial from the API
 * regardless of what happens here. `frontend.md` is explicit that permission
 * checks control visible actions while every API denial must still be handled.
 */

import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../auth/context'
import type { Capability } from '../api/types'

/**
 * Requires an authenticated session.
 *
 * While status is `loading` nothing is decided — redirecting during resolution
 * would bounce a signed-in user to the sign-in page on every refresh.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'loading') {
    return <PageLoading />
  }

  if (status === 'anonymous') {
    // Preserve the attempted path so sign-in can return the user to it.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{children}</>
}

/**
 * Requires at least one of the listed capabilities.
 *
 * Renders an explanation rather than redirecting: a silent bounce to the
 * schedule leaves the user unsure whether the page exists, their permission is
 * missing, or something failed.
 */
export function RequireCapability({
  anyOf,
  children,
}: {
  anyOf: Capability[]
  children: ReactNode
}) {
  const { canAny } = useAuth()

  if (!canAny(...anyOf)) {
    return <NoPermission />
  }

  return <>{children}</>
}

export function PageLoading() {
  return (
    <div className="crm-page">
      {/* Announced politely: a loading state is not an error, and should not
          interrupt whatever the user is doing. */}
      <p role="status" className="crm-muted">
        Загрузка…
      </p>
    </div>
  )
}

/**
 * Permission denial.
 *
 * Deliberately names nothing about the hidden record. `ui-ux.md` section 10
 * requires a concise explanation and safe navigation without leaking the
 * hidden entity's name — otherwise the denial itself discloses what exists.
 */
export function NoPermission() {
  return (
    <div className="crm-page">
      <div className="crm-panel">
        <h1>Нет доступа</h1>
        <p className="crm-muted" style={{ marginTop: 'var(--crm-space-3)' }}>
          У вас нет прав для просмотра этого раздела. Если доступ нужен для
          работы, обратитесь к администратору.
        </p>
      </div>
    </div>
  )
}

export function NotFound() {
  return (
    <div className="crm-page">
      <div className="crm-panel">
        <h1>Страница не найдена</h1>
        <p className="crm-muted" style={{ marginTop: 'var(--crm-space-3)' }}>
          Проверьте адрес или вернитесь к началу работы.
        </p>
      </div>
    </div>
  )
}
