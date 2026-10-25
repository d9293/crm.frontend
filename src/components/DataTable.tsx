/**
 * DataTable — `ui-ux.md` section 9.
 *
 * Stable row IDs, explicit states, and a total-scope label. The scope label is
 * load-bearing: `README.md` section 8 requires summary totals to cover all
 * matching records rather than the current page, and AC-13 checks that totals
 * stay stable across pagination. Rendering a bare count next to a paged table
 * invites exactly the misreading those rules exist to prevent.
 *
 * A wide table scrolls inside its own labelled container. The page body must
 * never scroll horizontally.
 */

import type { ReactNode } from 'react'
import './components.css'

export interface Column<Row> {
  key: string
  header: string
  render: (row: Row) => ReactNode
  /** Right-align money and other numerics. */
  numeric?: boolean
}

interface DataTableProps<Row> {
  caption: string
  columns: Column<Row>[]
  rows: Row[]
  /** Stable identity. Never the array index — it changes as data changes. */
  rowId: (row: Row) => string | number
  state?: 'ready' | 'loading' | 'error'
  /** Total matching the current filter, across every page. */
  total?: number
  /** Shown when `state` is `ready` and there are no rows. */
  emptyMessage?: string
  /** Retry affordance for the error state. */
  onRetry?: () => void
  /**
   * Set while showing previously loaded data that may be out of date. Section
   * 10 requires the last-update state to be visible and revalidated before a
   * decision is made on it.
   */
  stale?: boolean
  lastUpdatedLabel?: string
}

export function DataTable<Row>({
  caption,
  columns,
  rows,
  rowId,
  state = 'ready',
  total,
  emptyMessage = 'Нет записей, соответствующих фильтру.',
  onRetry,
  stale = false,
  lastUpdatedLabel,
}: DataTableProps<Row>) {
  if (state === 'loading') {
    return (
      <div className="table-shell">
        {/*
          Skeleton matching the final geometry. No zero totals during load:
          «0» would assert an answer the request has not returned yet.
        */}
        <div className="table-skeleton" role="status" aria-label="Загрузка данных">
          {[0, 1, 2, 3, 4].map((index) => (
            <div className="table-skeleton__row" key={index} />
          ))}
        </div>
      </div>
    )
  }

  if (state === 'error') {
    return (
      <div className="table-shell">
        <div className="alert alert--error" role="alert">
          <strong className="alert__title">Не удалось загрузить данные</strong>
          <div className="alert__body">
            Фильтры сохранены. Попробуйте обновить список.
          </div>
          {onRetry && (
            <button type="button" className="shell__control" onClick={onRetry}>
              Обновить
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="table-shell">
      {(total !== undefined || stale) && (
        <div className="table-shell__meta">
          {total !== undefined && (
            <span className="crm-meta">
              {/* Explicitly scoped: this is the filtered total, not the page. */}
              Найдено по фильтру: <span className="crm-numeric">{total}</span>
            </span>
          )}
          {stale && (
            <span className="crm-meta" role="status">
              Данные могли измениться
              {lastUpdatedLabel ? ` · обновлено ${lastUpdatedLabel}` : ''}
            </span>
          )}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="table-shell__empty">
          <p className="crm-muted">{emptyMessage}</p>
        </div>
      ) : (
        // Labelled local scroll container: wide content scrolls here, never
        // the document.
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label={`${caption} — прокручиваемая таблица`}
        >
          <table className="table">
            <caption className="crm-visually-hidden">{caption}</caption>
            <thead>
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className={column.numeric ? 'table__cell--numeric' : undefined}
                  >
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={rowId(row)}>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={
                        column.numeric
                          ? 'table__cell--numeric crm-numeric'
                          : undefined
                      }
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
