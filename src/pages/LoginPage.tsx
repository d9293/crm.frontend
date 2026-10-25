/**
 * P01 sign in — T1 access template.
 *
 * The form layout, labels and error regions are real. The submit path is NOT:
 * there is no authentication endpoint until BE-01, and FE-01 implements the
 * real flow including throttling feedback, session expiry and the D-02
 * first-use and recovery journeys.
 *
 * Submit is therefore disabled with a visible explanation rather than wired to
 * something that appears to work. A form that silently fails, or one that
 * fakes success, is worse than one that states its status.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/context'
import { ThemeSelect } from '../shells/HeaderControls'
import { PREVIEW_USERS } from '../dev/previewUsers'
import '../shells/shells.css'

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')

  return (
    <div className="shell shell--access">
      <div className="access-card">
        <h1>ACE / CSKA CRM</h1>
        <p className="crm-muted" style={{ marginTop: 'var(--crm-space-2)' }}>
          Вход для сотрудников, тренеров и клиентов
        </p>

        <form
          style={{
            display: 'grid',
            gap: 'var(--crm-space-4)',
            marginTop: 'var(--crm-space-5)',
          }}
          onSubmit={(event) => event.preventDefault()}
        >
          <label style={{ display: 'grid', gap: 'var(--crm-space-1)' }}>
            <span style={{ fontSize: 'var(--crm-font-size-label)' }}>Логин</span>
            <input
              className="shell__control"
              style={{ cursor: 'text', width: '100%' }}
              type="text"
              name="identifier"
              autoComplete="username"
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
            />
          </label>

          <label style={{ display: 'grid', gap: 'var(--crm-space-1)' }}>
            <span style={{ fontSize: 'var(--crm-font-size-label)' }}>Пароль</span>
            <input
              className="shell__control"
              style={{ cursor: 'text', width: '100%' }}
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

          <button type="submit" className="shell__control shell__control--primary" disabled>
            Войти
          </button>

          <p className="crm-meta" role="note">
            Вход будет подключён в задаче FE-01 после появления BE-01.
            Восстановление доступа зависит от решения D-02.
          </p>
        </form>

        {import.meta.env.DEV && <PreviewSwitcher />}

        <div style={{ marginTop: 'var(--crm-space-5)' }}>
          <ThemeSelect />
        </div>
      </div>
    </div>
  )
}

/**
 * Development-only shell preview.
 *
 * Gated on `import.meta.env.DEV`, which Vite statically replaces with `false`
 * in a production build, so this component and its fixtures are removed by
 * dead-code elimination rather than merely hidden at runtime.
 *
 * This is a review harness for the S0 design deliverable, not a sign-in path.
 */
function PreviewSwitcher() {
  const { setUser } = useAuth()
  const navigate = useNavigate()

  function preview(key: string) {
    const entry = PREVIEW_USERS.find((candidate) => candidate.key === key)
    if (!entry) return

    setUser(entry.user)
    navigate(entry.user.role === 'customer' ? '/customer/availability'
      : entry.user.role === 'coach' ? '/coach/schedule'
      : '/staff/schedule')
  }

  return (
    <section
      style={{
        marginTop: 'var(--crm-space-5)',
        paddingTop: 'var(--crm-space-4)',
        borderTop: '1px solid var(--crm-border)',
      }}
    >
      <h2 style={{ fontSize: 'var(--crm-font-size-label)' }}>
        Просмотр оболочек (только разработка)
      </h2>
      <p className="crm-meta" style={{ marginTop: 'var(--crm-space-1)' }}>
        Синтетические данные для обзора дизайна S0. Не является входом в
        систему и не выдаёт прав.
      </p>

      <div
        style={{
          display: 'grid',
          gap: 'var(--crm-space-2)',
          marginTop: 'var(--crm-space-3)',
        }}
      >
        {PREVIEW_USERS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            className="shell__control"
            style={{ textAlign: 'left', padding: 'var(--crm-space-2) var(--crm-space-3)' }}
            onClick={() => preview(entry.key)}
          >
            <span style={{ display: 'block', fontWeight: 'var(--crm-weight-medium)' }}>
              {entry.label}
            </span>
            <span className="crm-meta">{entry.purpose}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
