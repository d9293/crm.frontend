/**
 * Component tests.
 *
 * Concentrated on the behaviour that protects a business rule: the hold
 * countdown's independence from the browser clock, money parsing without
 * floating point, and the decision dialog's reason policy and focus handling.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { HoldTimer } from './HoldTimer'
import { CancellationBadge, PaymentBadge, ReservationBadge } from './StatusBadge'
import { MoneyField } from './MoneyField'
import type { ReservationState } from '../api/types'
import { parseTengeToMinorUnits } from '../lib/money'
import { DecisionDialog } from './DecisionDialog'
import { ResourceSlot } from './ResourceSlot'
import { DataTable } from './DataTable'
import { formatInterval, formatLocalDate, formatMoney } from '../lib/format'

describe('StatusBadge', () => {
  // Every state the contract defines must have a label. `satisfies` already
  // enforces this at compile time; this asserts it renders rather than
  // throwing on an unmapped key.
  const allStates: ReservationState[] = [
    'pending_confirmation',
    'confirmed',
    'rejected',
    'expired',
    'canceled',
  ]

  it('renders a text label for every reservation state in the contract', () => {
    for (const state of allStates) {
      const { unmount } = render(<ReservationBadge state={state} />)
      // Text, not colour: UX requires status to be readable without hue.
      expect(screen.getByText(/\S/).textContent?.trim().length).toBeGreaterThan(0)
      unmount()
    }
  })

  it('keeps payment separate from reservation state', () => {
    // A confirmed, unpaid booking is two badges. Payment is never a
    // reservation state (BR-06), and UX-04 needs the combination legible.
    render(
      <>
        <ReservationBadge state="confirmed" />
        <PaymentBadge state="unpaid" />
      </>,
    )

    expect(screen.getByText('Бронь подтверждена')).toBeTruthy()
    expect(screen.getByText('Не оплачено')).toBeTruthy()
  })

  it('shows a pending cancellation alongside a still-confirmed booking', () => {
    // While a cancellation is pending the court stays reserved, so both
    // badges appear. Collapsing them into one ambiguous status is forbidden.
    render(
      <>
        <ReservationBadge state="confirmed" />
        <CancellationBadge state="pending" />
      </>,
    )

    expect(screen.getByText('Бронь подтверждена')).toBeTruthy()
    expect(screen.getByText('Запрошена отмена')).toBeTruthy()
  })
})

describe('parseTengeToMinorUnits', () => {
  it('converts whole and fractional tenge to integer minor units', () => {
    expect(parseTengeToMinorUnits('15000')).toBe(1_500_000)
    expect(parseTengeToMinorUnits('15000,50')).toBe(1_500_050)
    expect(parseTengeToMinorUnits('15000.50')).toBe(1_500_050)
    expect(parseTengeToMinorUnits('1 500')).toBe(150_000)
  })

  it('avoids the floating-point error that naive parsing produces', () => {
    // parseFloat('0.07') * 100 === 7.000000000000001
    expect(parseTengeToMinorUnits('0,07')).toBe(7)
    expect(Number.isInteger(parseTengeToMinorUnits('0,07'))).toBe(true)
    expect(parseTengeToMinorUnits('0,29')).toBe(29)
    expect(parseTengeToMinorUnits('1,01')).toBe(101)
  })

  it('distinguishes empty from invalid', () => {
    expect(parseTengeToMinorUnits('')).toBeNull()
    expect(parseTengeToMinorUnits('abc')).toBeUndefined()
    // More than two fractional digits is not silently rounded away.
    expect(parseTengeToMinorUnits('10,005')).toBeUndefined()
  })

  it('handles negative amounts for refunds', () => {
    expect(parseTengeToMinorUnits('-10000')).toBe(-1_000_000)
  })
})

describe('formatMoney', () => {
  it('omits fractional digits when the amount is whole tenge', () => {
    expect(formatMoney(1_500_000)).not.toContain(',00')
  })

  it('shows a non-zero remainder rather than rounding it away', () => {
    expect(formatMoney(1_500_050)).toContain('50')
  })

  it('throws when handed a float, so money bugs fail loudly', () => {
    expect(() => formatMoney(1500.5)).toThrow(TypeError)
  })
})

describe('date and interval formatting', () => {
  it('names the next date when a booking ends at midnight', () => {
    // 23:00-00:00 Almaty. The end belongs to the following calendar date, and
    // a renderer that hides this loses the fact (AC-07).
    //
    // Offsets below are UTC+5: Kazakhstan unified its timezones on 1 March
    // 2024, moving Asia/Almaty from UTC+6 to UTC+5. Anything written against
    // the old +06 is an hour wrong.
    const sameDay = formatInterval('2026-10-25T04:00:00Z', '2026-10-25T05:30:00Z')
    const acrossMidnight = formatInterval('2026-10-25T18:00:00Z', '2026-10-25T19:00:00Z')

    expect(sameDay).toBe('09:00–10:30')
    expect(acrossMidnight).toContain('23:00–00:00')
    expect(acrossMidnight).toContain('26.10.2026')
  })

  it('does not shift a date-only value', () => {
    // `new Date('2026-10-25')` parses as UTC midnight, which can render as the
    // 24th. Birth dates and tariff dates must not move.
    expect(formatLocalDate('2026-10-25')).toContain('25')
    expect(formatLocalDate('2026-01-01')).toContain('2026')
  })
})

describe('HoldTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('derives remaining time from server values, not the device clock', () => {
    // Device clock far in the future. A browser-clock implementation would
    // treat the hold as long expired.
    vi.setSystemTime(new Date('2027-01-01T00:00:00Z'))

    render(
      <HoldTimer expiresAt="2026-10-25T09:05:00Z" serverTime="2026-10-25T09:00:00Z" />,
    )

    expect(screen.getByText('5:00')).toBeTruthy()
  })

  it('enters a checking state at zero without inventing an outcome', () => {
    const onExpiryReached = vi.fn()

    render(
      <HoldTimer
        expiresAt="2026-10-25T09:00:00Z"
        serverTime="2026-10-25T09:00:00Z"
        onExpiryReached={onExpiryReached}
      />,
    )

    // Zero remaining: asks the caller to reconcile, and claims nothing itself.
    expect(screen.getByText(/Проверяем статус/)).toBeTruthy()
    expect(screen.queryByText(/подтверждена/i)).toBeNull()
  })

  it('reports server-confirmed expiry only when told by the server', () => {
    render(
      <HoldTimer
        expiresAt="2026-10-25T09:05:00Z"
        serverTime="2026-10-25T09:00:00Z"
        serverExpired
      />,
    )

    expect(screen.getByText(/Время ожидания истекло/)).toBeTruthy()
  })

  it('states that a local timer is not a booking when offline', () => {
    render(
      <HoldTimer
        expiresAt="2026-10-25T09:05:00Z"
        serverTime="2026-10-25T09:00:00Z"
        offline
      />,
    )

    expect(screen.getByText(/Нет соединения/)).toBeTruthy()
  })

  it('does not announce every second to assistive technology', () => {
    render(
      <HoldTimer expiresAt="2026-10-25T09:05:00Z" serverTime="2026-10-25T09:00:00Z" />,
    )

    // The live region carries a stable sentence with the deadline; the ticking
    // digits are aria-hidden.
    const live = screen.getByRole('status')
    expect(live.textContent).toContain('Время удерживается до')
    expect(live.textContent).not.toContain('5:00')
  })
})

describe('MoneyField', () => {
  it('explains that a paid amount is locked rather than just disabling it', () => {
    render(<MoneyField label="Сумма" value={1_000_000} onChange={() => {}} disabled />)

    expect(screen.getByText(/Сумма закрыта для изменений/)).toBeTruthy()
  })

  it('links a server field error to the input', () => {
    render(
      <MoneyField label="Сумма" value={null} onChange={() => {}} error="Укажите сумму." />,
    )

    const input = screen.getByLabelText('Сумма')
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(input.getAttribute('aria-describedby')).toBeTruthy()
    expect(screen.getByText('Укажите сумму.')).toBeTruthy()
  })

  it('avoids type=number, whose stepping and locale handling are hazards on money', () => {
    render(<MoneyField label="Сумма" value={null} onChange={() => {}} />)

    const input = screen.getByLabelText('Сумма')
    expect(input.getAttribute('type')).toBe('text')
    expect(input.getAttribute('inputMode')).toBe('decimal')
  })
})

describe('DecisionDialog', () => {
  it('states the consequence instead of a bare confirmation', () => {
    render(
      <DecisionDialog
        open
        title="Одобрить отмену"
        consequence="Корт освободится. Возврат денег не оформляется автоматически."
        confirmLabel="Одобрить отмену"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )

    expect(screen.getByText(/Возврат денег не оформляется автоматически/)).toBeTruthy()
    // The action names its object; «Готово» is forbidden for a state change.
    expect(screen.getByRole('button', { name: 'Одобрить отмену' })).toBeTruthy()
  })

  it('blocks confirmation while a required reason is empty', () => {
    render(
      <DecisionDialog
        open
        title="Одобрить отмену"
        consequence="Корт освободится."
        confirmLabel="Одобрить отмену"
        reasonPolicy="required"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: 'Одобрить отмену' })).toHaveProperty(
      'disabled',
      true,
    )
  })

  it('permits confirmation with no reason when the policy is optional', () => {
    render(
      <DecisionDialog
        open
        title="Отклонить заявку"
        consequence="Время освободится."
        confirmLabel="Отклонить заявку"
        reasonPolicy="optional"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )

    // A reason must not be required merely because a designer assumed one.
    expect(screen.getByRole('button', { name: 'Отклонить заявку' })).toHaveProperty(
      'disabled',
      false,
    )
  })

  it('renders no reason field when the policy is none', () => {
    render(
      <DecisionDialog
        open
        title="Архивировать"
        consequence="История сохранится."
        confirmLabel="Архивировать"
        reasonPolicy="none"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )

    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('is a modal dialog labelled by its heading, with focus on the heading', () => {
    render(
      <DecisionDialog
        open
        title="Отклонить заявку"
        consequence="Время освободится."
        confirmLabel="Отклонить заявку"
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )

    const dialog = screen.getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(document.activeElement?.textContent).toBe('Отклонить заявку')
  })

  it('disables both actions while the command is in flight', () => {
    render(
      <DecisionDialog
        open
        title="Отклонить заявку"
        consequence="Время освободится."
        confirmLabel="Отклонить заявку"
        submitting
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    )

    expect(screen.getByRole('button', { name: 'Выполняется…' })).toHaveProperty(
      'disabled',
      true,
    )
    expect(screen.getByRole('button', { name: 'Отмена' })).toHaveProperty('disabled', true)
  })
})

describe('ResourceSlot', () => {
  it('discloses nothing about who holds an occupied slot', () => {
    const { container } = render(
      <ResourceSlot
        resourceName="Корт 1"
        startsAt="2026-10-25T04:00:00Z"
        endsAt="2026-10-25T05:00:00Z"
        state="held"
      />,
    )

    // A customer may know only that the slot is unavailable.
    expect(screen.getByText('Недоступно')).toBeTruthy()
    expect(container.textContent).not.toMatch(/клиент|бронь №|\+7/i)
    expect(container.querySelector('[title]')).toBeNull()
  })

  it('is a real button, so timetable selection works from the keyboard', () => {
    render(
      <ResourceSlot
        resourceName="Корт 1"
        startsAt="2026-10-25T04:00:00Z"
        endsAt="2026-10-25T05:00:00Z"
        state="free"
      />,
    )

    const slot = screen.getByRole('button', { name: /Корт 1.*Свободно/ })
    expect(slot.tagName).toBe('BUTTON')
  })

  it('cannot be selected when unavailable', () => {
    render(
      <ResourceSlot
        resourceName="Корт 1"
        startsAt="2026-10-25T04:00:00Z"
        endsAt="2026-10-25T05:00:00Z"
        state="unavailable"
      />,
    )

    expect(screen.getByRole('button')).toHaveProperty('disabled', true)
  })
})

describe('DataTable', () => {
  const columns = [{ key: 'name', header: 'Имя', render: (row: { name: string }) => row.name }]

  it('labels the total as covering the filter, not the page', () => {
    render(
      <DataTable
        caption="Клиенты"
        columns={columns}
        rows={[{ name: 'Абаев' }]}
        rowId={(row) => row.name}
        total={42}
      />,
    )

    expect(screen.getByText(/Найдено по фильтру/)).toBeTruthy()
    expect(screen.getByText('42')).toBeTruthy()
  })

  it('shows no total while loading, rather than a misleading zero', () => {
    render(
      <DataTable
        caption="Клиенты"
        columns={columns}
        rows={[]}
        rowId={(row) => row.name}
        state="loading"
        total={0}
      />,
    )

    expect(screen.getByRole('status', { name: 'Загрузка данных' })).toBeTruthy()
    expect(screen.queryByText(/Найдено по фильтру/)).toBeNull()
  })

  it('keeps filters and offers a retry on error', () => {
    render(
      <DataTable
        caption="Клиенты"
        columns={columns}
        rows={[]}
        rowId={(row) => row.name}
        state="error"
        onRetry={() => {}}
      />,
    )

    expect(screen.getByText(/Фильтры сохранены/)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Обновить' })).toBeTruthy()
  })

  it('flags stale data so a decision is not made on it', () => {
    render(
      <DataTable
        caption="Клиенты"
        columns={columns}
        rows={[{ name: 'Абаев' }]}
        rowId={(row) => row.name}
        total={1}
        stale
        lastUpdatedLabel="09:00"
      />,
    )

    expect(screen.getByText(/Данные могли измениться/)).toBeTruthy()
  })

  it('confines horizontal scrolling to a labelled region', () => {
    render(
      <DataTable
        caption="Клиенты"
        columns={columns}
        rows={[{ name: 'Абаев' }]}
        rowId={(row) => row.name}
      />,
    )

    // The document must never scroll sideways; the table does.
    expect(screen.getByRole('region', { name: /прокручиваемая таблица/ })).toBeTruthy()
  })
})
