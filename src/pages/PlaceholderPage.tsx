/**
 * Page placeholder.
 *
 * Every P01–P21 route resolves to a real, reachable page so navigation,
 * permission guards, shells and responsive layout can be reviewed end to end
 * in S0. Each placeholder states plainly which ticket implements it and which
 * decisions gate it.
 *
 * It shows no invented data. `ui-ux.md` section 10 forbids zero totals during
 * loading and empty states that misrepresent a genuine result — a placeholder
 * displaying «0 ₸» or an empty table would assert something false about the
 * club's actual records.
 */

interface PlaceholderPageProps {
  /** Page identifier from the specification inventory, e.g. `P09`. */
  pageId: string
  title: string
  /** Implementing ticket, e.g. `FE-09`. */
  ticket: string
  /** Sprint, e.g. `S3`. */
  sprint: string
  /** Layout template from `ui-ux.md` section 4, e.g. `T3`. */
  template: string
  /** Blocking decisions, e.g. `['D-06']`. Empty when none. */
  gates?: string[]
}

export default function PlaceholderPage({
  pageId,
  title,
  ticket,
  sprint,
  template,
  gates = [],
}: PlaceholderPageProps) {
  return (
    <div className="crm-page">
      <div className="crm-page__header">
        <div>
          <h1>{title}</h1>
          <p className="crm-meta" style={{ marginTop: 'var(--crm-space-1)' }}>
            {pageId} · спринт {sprint} · шаблон {template}
          </p>
        </div>
      </div>

      <div className="crm-panel">
        <h2>Страница ещё не реализована</h2>
        <p className="crm-muted" style={{ marginTop: 'var(--crm-space-3)' }}>
          Маршрут, навигация и проверка прав работают. Содержимое реализуется
          в задаче <strong>{ticket}</strong>.
        </p>

        {gates.length > 0 && (
          <p style={{ marginTop: 'var(--crm-space-4)' }}>
            <span className="crm-meta">Ожидает решений: </span>
            <strong>{gates.join(', ')}</strong>
          </p>
        )}
      </div>
    </div>
  )
}
