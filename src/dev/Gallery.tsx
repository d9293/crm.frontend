/**
 * Component state gallery — the S0 review deliverable in `ui-ux.md` §12.
 *
 * Every component with its documented variants on one page, so design review
 * happens against rendered components rather than token swatches. UX-10 is
 * explicit that both themes must be verified on final rendered components, and
 * the theme control in the header switches live.
 *
 * Dev-only: reachable at `/dev/gallery`, gated on `import.meta.env.DEV` in the
 * route table so it is dead-code eliminated from production.
 */

import { useState } from 'react'
import {
  CancellationBadge,
  MembershipBadge,
  PaymentBadge,
  ReservationBadge,
} from '../components/StatusBadge'
import { HoldTimer } from '../components/HoldTimer'
import { MoneyField } from '../components/MoneyField'
import { InlineAlert, UncertainOutcomeAlert } from '../components/InlineAlert'
import { DataTable, type Column } from '../components/DataTable'
import { DecisionDialog } from '../components/DecisionDialog'
import { ResourceSlot } from '../components/ResourceSlot'
import { ThemeSelect } from '../shells/HeaderControls'
import { formatInterval, formatMoney, formatMoneySigned } from '../lib/format'
import {
  fixtureHold,
  fixtureVersionConflictError,
} from '../api/fixtures'

function Section({ title, note, children }: {
  title: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <section className="crm-panel" style={{ marginBottom: 'var(--crm-space-5)' }}>
      <h2>{title}</h2>
      {note && (
        <p className="crm-meta" style={{ marginTop: 'var(--crm-space-1)' }}>{note}</p>
      )}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 'var(--crm-space-3)',
          alignItems: 'flex-start',
          marginTop: 'var(--crm-space-4)',
        }}
      >
        {children}
      </div>
    </section>
  )
}

interface DemoRow {
  id: number
  court: string
  interval: string
  amount: number
}

const DEMO_ROWS: DemoRow[] = [
  { id: 1, court: 'Корт 1', interval: '09:00–10:30', amount: 1_500_000 },
  { id: 2, court: 'Корт 4', interval: '23:00–00:00', amount: 900_000 },
  { id: 3, court: 'Корт 7', interval: '18:00–19:30', amount: -1_000_000 },
]

const DEMO_COLUMNS: Column<DemoRow>[] = [
  { key: 'court', header: 'Ресурс', render: (row) => row.court },
  { key: 'interval', header: 'Время', render: (row) => row.interval },
  {
    key: 'amount',
    header: 'Сумма',
    numeric: true,
    render: (row) =>
      row.amount < 0 ? formatMoneySigned(row.amount) : formatMoney(row.amount),
  },
]

export default function Gallery() {
  const [amount, setAmount] = useState<number | null>(1_500_000)
  const [dialog, setDialog] = useState<'none' | 'reject' | 'cancel'>('none')
  const [selectedSlot, setSelectedSlot] = useState(false)

  return (
    <div className="crm-page">
      <div className="crm-page__header">
        <div>
          <h1>Галерея компонентов</h1>
          <p className="crm-meta" style={{ marginTop: 'var(--crm-space-1)' }}>
            Контракт ui-ux.md §9 · только для разработки · синтетические данные
          </p>
        </div>
        <ThemeSelect />
      </div>

      <Section
        title="Статусы"
        note="Отдельные словари: состояние заявки, брони, отмены, оплаты и абонемента не смешиваются. Оплата никогда не является состоянием брони."
      >
        <ReservationBadge state="pending_confirmation" />
        <ReservationBadge state="confirmed" />
        <ReservationBadge state="rejected" />
        <ReservationBadge state="expired" />
        <ReservationBadge state="canceled" />
        <CancellationBadge state="pending" />
        <CancellationBadge state="approved" />
        <PaymentBadge state="unpaid" />
        <PaymentBadge state="partly_paid" />
        <PaymentBadge state="paid" />
        <PaymentBadge state="refunded" />
        <MembershipBadge state="pending_activation" />
        <MembershipBadge state="active" />
        <MembershipBadge state="frozen" />
      </Section>

      <Section
        title="Комбинации состояний (UX-04)"
        note="Подтверждено и не оплачено, подтверждено и запрошена отмена — различимые комбинации, а не один неоднозначный статус."
      >
        <div style={{ display: 'flex', gap: 'var(--crm-space-2)' }}>
          <ReservationBadge state="confirmed" />
          <PaymentBadge state="unpaid" />
        </div>
        <div style={{ display: 'flex', gap: 'var(--crm-space-2)' }}>
          <ReservationBadge state="confirmed" />
          <CancellationBadge state="pending" />
        </div>
      </Section>

      <Section
        title="Таймер удержания"
        note="Отсчёт от времени сервера по монотонным часам. Ноль не означает исход — только сервер решает, живо ли удержание."
      >
        <HoldTimer
          expiresAt={fixtureHold.hold_expires_at}
          serverTime={fixtureHold.server_time}
        />
        <HoldTimer
          expiresAt={fixtureHold.server_time}
          serverTime={fixtureHold.server_time}
        />
        <HoldTimer
          expiresAt={fixtureHold.hold_expires_at}
          serverTime={fixtureHold.server_time}
          serverExpired
        />
        <HoldTimer
          expiresAt={fixtureHold.hold_expires_at}
          serverTime={fixtureHold.server_time}
          offline
        />
      </Section>

      <Section
        title="Слоты ресурса"
        note="Занятый слот не раскрывает, кто его занял. Выбор слота не создаёт удержания."
      >
        <ResourceSlot
          resourceName="Корт 1"
          startsAt="2026-10-25T04:00:00Z"
          endsAt="2026-10-25T05:00:00Z"
          state={selectedSlot ? 'selected' : 'free'}
          onSelect={() => setSelectedSlot((previous) => !previous)}
        />
        <ResourceSlot
          resourceName="Корт 2"
          startsAt="2026-10-25T05:00:00Z"
          endsAt="2026-10-25T06:00:00Z"
          state="held"
        />
        <ResourceSlot
          resourceName="Корт 3"
          startsAt="2026-10-25T06:00:00Z"
          endsAt="2026-10-25T07:00:00Z"
          state="unavailable"
        />
        <ResourceSlot
          resourceName="Корт 4"
          startsAt="2026-10-25T07:00:00Z"
          endsAt="2026-10-25T08:00:00Z"
          state="closed"
        />
      </Section>

      <Section
        title="Поле суммы"
        note="Целые минимальные единицы. Поле закрыто, если композиция оплачена — изменение оформляется корректировкой."
      >
        <div style={{ minWidth: 220 }}>
          <MoneyField label="Сумма оплаты" value={amount} onChange={setAmount} />
        </div>
        <div style={{ minWidth: 220 }}>
          <MoneyField
            label="Сумма (оплачено)"
            value={1_000_000}
            onChange={() => {}}
            disabled
          />
        </div>
        <div style={{ minWidth: 220 }}>
          {/* A money-shaped error. The fixture's field_errors are keyed by
              employee fields, so reusing one here would show «Укажите имя
              сотрудника» under a currency input. */}
          <MoneyField
            label="Сумма с ошибкой"
            value={null}
            onChange={() => {}}
            error="Укажите сумму оплаты."
          />
        </div>
      </Section>

      <Section title="Сообщения">
        <div style={{ minWidth: 280 }}>
          <InlineAlert tone="info">Фильтры сохранены.</InlineAlert>
        </div>
        <div style={{ minWidth: 280 }}>
          <InlineAlert tone="warning" title="Данные могли измениться">
            Обновите список перед решением.
          </InlineAlert>
        </div>
        <div style={{ minWidth: 280 }}>
          <InlineAlert
            tone="error"
            title="Запись изменена"
            correlationId={fixtureVersionConflictError.correlation_id}
            action={{ label: 'Обновить', onClick: () => {} }}
          >
            {fixtureVersionConflictError.message}
          </InlineAlert>
        </div>
        <div style={{ minWidth: 280 }}>
          <UncertainOutcomeAlert onRecover={() => {}} correlationId="018f3a2c" />
        </div>
      </Section>

      <Section
        title="Таблица — состояния"
        note="Итог относится ко всему фильтру, а не к странице. Широкая таблица прокручивается внутри своего контейнера."
      >
        <div style={{ minWidth: 320, flex: 1 }}>
          <DataTable
            caption="Пример данных"
            columns={DEMO_COLUMNS}
            rows={DEMO_ROWS}
            rowId={(row) => row.id}
            total={42}
          />
        </div>
        <div style={{ minWidth: 320, flex: 1 }}>
          <DataTable
            caption="Загрузка"
            columns={DEMO_COLUMNS}
            rows={[]}
            rowId={(row) => row.id}
            state="loading"
          />
        </div>
        <div style={{ minWidth: 320, flex: 1 }}>
          <DataTable
            caption="Пусто"
            columns={DEMO_COLUMNS}
            rows={[]}
            rowId={(row) => row.id}
            total={0}
          />
        </div>
        <div style={{ minWidth: 320, flex: 1 }}>
          <DataTable
            caption="Ошибка"
            columns={DEMO_COLUMNS}
            rows={[]}
            rowId={(row) => row.id}
            state="error"
            onRetry={() => {}}
          />
        </div>
        <div style={{ minWidth: 320, flex: 1 }}>
          <DataTable
            caption="Устаревшие данные"
            columns={DEMO_COLUMNS}
            rows={DEMO_ROWS}
            rowId={(row) => row.id}
            total={42}
            stale
            lastUpdatedLabel="09:00"
          />
        </div>
      </Section>

      <Section
        title="Диалог решения"
        note="Называет последствие, а не «Вы уверены?». Политика причины приходит от API, а не от предположения дизайнера."
      >
        <button
          type="button"
          className="shell__control"
          onClick={() => setDialog('reject')}
        >
          Отклонить заявку
        </button>
        <button
          type="button"
          className="shell__control"
          onClick={() => setDialog('cancel')}
        >
          Одобрить отмену
        </button>
      </Section>

      <Section
        title="Формат времени и денег"
        note="Полночь относится к следующей дате. Отрицательные суммы подписаны знаком, а не только цветом."
      >
        <ul style={{ margin: 0, paddingLeft: 'var(--crm-space-5)' }}>
          {/* UTC+5: Asia/Almaty moved from +06 to +05 on 1 March 2024. */}
          <li className="crm-numeric">
            {formatInterval('2026-10-25T04:00:00Z', '2026-10-25T05:30:00Z')} — 90 минут
          </li>
          <li className="crm-numeric">
            {formatInterval('2026-10-25T18:00:00Z', '2026-10-25T19:00:00Z')} — через полночь
          </li>
          <li className="crm-numeric">{formatMoney(1_500_000)}</li>
          <li className="crm-numeric">{formatMoney(1_500_050)}</li>
          <li className="crm-numeric">{formatMoneySigned(-1_000_000)}</li>
        </ul>
      </Section>

      <DecisionDialog
        open={dialog === 'reject'}
        title="Отклонить заявку"
        consequence="Время будет освобождено и снова станет доступным для бронирования. Клиент увидит, что заявка отклонена."
        confirmLabel="Отклонить заявку"
        reasonPolicy="optional"
        onConfirm={() => setDialog('none')}
        onCancel={() => setDialog('none')}
      />

      <DecisionDialog
        open={dialog === 'cancel'}
        title="Одобрить отмену"
        consequence="Бронь будет отменена, корт освободится. Возврат денег не оформляется автоматически."
        confirmLabel="Одобрить отмену"
        reasonPolicy="required"
        onConfirm={() => setDialog('none')}
        onCancel={() => setDialog('none')}
      />
    </div>
  )
}
