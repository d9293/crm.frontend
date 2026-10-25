/**
 * Shell and guard smoke tests.
 *
 * These verify that the three role shells actually render and that the
 * navigation and route guards hide what the user may not reach. Compilation
 * and a passing build prove neither.
 *
 * The scope is deliberately narrow: what renders, for whom. These are not
 * authorization tests. Authorization is the server's responsibility, and
 * BE-02 covers it with direct API attempts that bypass the UI entirely — a
 * passing test here says nothing about whether the API would refuse the call.
 */

import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AuthProvider } from '../auth/AuthProvider'
import { LocationProvider } from '../location/LocationProvider'
import { ThemeProvider } from '../theme/ThemeProvider'
import AppRoutes from '../routes/AppRoutes'
import { PREVIEW_USERS } from '../dev/previewUsers'
import type { CurrentUser } from '../api/types'

function userByKey(key: string): CurrentUser {
  const entry = PREVIEW_USERS.find((candidate) => candidate.key === key)
  if (!entry) throw new Error(`No preview user named ${key}`)
  return entry.user
}

function renderAt(path: string, user: CurrentUser | null) {
  return render(
    <ThemeProvider>
      <AuthProvider initialUser={user} initialStatus={user ? 'authenticated' : 'anonymous'}>
        <LocationProvider>
          <MemoryRouter initialEntries={[path]}>
            <AppRoutes />
          </MemoryRouter>
        </LocationProvider>
      </AuthProvider>
    </ThemeProvider>,
  )
}

describe('staff shell', () => {
  it('renders all four navigation groups for a Power User', () => {
    renderAt('/staff/schedule', userByKey('power_user'))

    expect(screen.getByText('Ежедневная работа')).toBeTruthy()
    expect(screen.getByText('Клиенты и тренировки')).toBeTruthy()
    expect(screen.getByText('Финансы')).toBeTruthy()
    expect(screen.getByText('Администрирование')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1, name: 'Расписание' })).toBeTruthy()
  })

  it('omits finance and administration groups for an operator without those grants', () => {
    renderAt('/staff/schedule', userByKey('operator_ace'))

    expect(screen.getByText('Ежедневная работа')).toBeTruthy()
    // A group with no permitted destination is omitted entirely rather than
    // left as an empty heading.
    expect(screen.queryByText('Финансы')).toBeNull()
    expect(screen.queryByText('Администрирование')).toBeNull()
    expect(screen.queryByText('Зарплата')).toBeNull()
  })

  it('shows a denial instead of content when the capability is missing', () => {
    renderAt('/staff/payroll', userByKey('operator_ace'))

    expect(screen.getByRole('heading', { level: 1, name: 'Нет доступа' })).toBeTruthy()
    // The denial must not disclose the hidden section's name.
    expect(screen.queryByRole('heading', { level: 1, name: 'Зарплата' })).toBeNull()
  })
})

describe('location scope', () => {
  it('renders a single permitted location as text, with no selector to change it', () => {
    renderAt('/staff/schedule', userByKey('operator_ace'))

    expect(screen.getByText('ACE')).toBeTruthy()
    // One option is not a choice: an ACE-only employee gets no combobox, and
    // therefore no way to appear to switch to CSKA (AC-11, UX-05).
    expect(screen.queryByRole('combobox', { name: /Локация/ })).toBeNull()
  })

  it('offers a selector when two locations are permitted', () => {
    renderAt('/staff/schedule', userByKey('power_user'))

    const selector = screen.getByRole('combobox', { name: /Локация/ })
    expect(selector).toBeTruthy()
    expect(screen.getByRole('option', { name: 'ACE' })).toBeTruthy()
    expect(screen.getByRole('option', { name: 'CSKA' })).toBeTruthy()
  })
})

describe('customer shell', () => {
  it('renders exactly the two agreed destinations', () => {
    renderAt('/customer/availability', userByKey('customer'))

    // Two primary destinations, each appearing in both the header tabs and the
    // mobile bottom navigation.
    expect(screen.getAllByRole('link', { name: 'Забронировать корт' })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: 'Мои брони' })).toHaveLength(2)

    // No invented dashboard, and no membership or payment pages: those are
    // deferred under D-03 and must not appear even as teasers.
    expect(screen.queryByText('Абонементы')).toBeNull()
    expect(screen.queryByText('Платежи')).toBeNull()
  })

  it('refuses a customer reaching a staff route', () => {
    renderAt('/staff/customers', userByKey('customer'))

    expect(screen.getByRole('heading', { level: 1, name: 'Нет доступа' })).toBeTruthy()
  })
})

describe('coach shell', () => {
  it('hides the earnings destination without a finance grant', () => {
    renderAt('/coach/schedule', userByKey('coach'))

    expect(screen.getByRole('link', { name: 'Моё расписание' })).toBeTruthy()
    // A coach without finance rights never sees a link to amounts they may
    // not view.
    expect(screen.queryByRole('link', { name: 'Мои начисления' })).toBeNull()
  })
})

describe('unauthenticated access', () => {
  it('redirects a protected route to sign in', () => {
    renderAt('/staff/schedule', null)

    expect(screen.getByRole('heading', { level: 1, name: 'ACE / CSKA CRM' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Войти' })).toBeTruthy()
  })

  it('leaves the sign-in button disabled, since no auth endpoint exists yet', () => {
    renderAt('/login', null)

    const submit = screen.getByRole('button', { name: 'Войти' })
    // FE-01 enables this. A form that appears to work but cannot is worse than
    // one that states its status.
    expect(submit).toHaveProperty('disabled', true)
  })
})
