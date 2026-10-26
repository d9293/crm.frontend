/**
 * P07–P10 journey prototype — the S3 design deliverable in `ui-ux.md` §12.
 *
 * Customer and employee views side by side, driven by one in-memory
 * simulation, so a reviewer can watch a hold appear in the queue, tick down,
 * and resolve — without a backend.
 *
 * Side-by-side is deliberate: the five-minute hold is a *two-party*
 * interaction, and reviewing either half alone hides the question that
 * matters — whether an employee can realistically respond before the
 * countdown runs out, which is an input to D-16.
 *
 * **Not a working system.** Nothing persists, nothing is authorized, and the
 * simulation is not a reference implementation. Development builds only.
 *
 * All view data lives in one `snapshot`, re-read by `read()`. That function is
 * called from a lazy state initializer, from the clock interval, and from each
 * user action — never from an effect reacting to other state. Reading the
 * simulation settles expiries, which is a mutation, so it must not happen
 * during render.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AvailabilityResponse, CancellationRequest, Reservation } from '../../api/types'
import { AvailabilityPicker, type SlotSelection } from '../../features/booking/AvailabilityPicker'
import { RequestSummary } from '../../features/booking/RequestSummary'
import { ReservationStatusCard } from '../../features/booking/ReservationStatusCard'
import { ApprovalQueue } from '../../features/booking/ApprovalQueue'
import { CancellationQueue } from '../../features/booking/CancellationQueue'
import { DecisionDialog } from '../../components/DecisionDialog'
import { InlineAlert } from '../../components/InlineAlert'
import { ThemeSelect } from '../../shells/HeaderControls'
import { beginCommand } from '../../api/client'
import { businessToday } from '../../lib/time'
import { FakeServer, REAL_HOLD_SECONDS, instantFor } from './fakeServer'
import '../../features/booking/booking.css'

const CUSTOMER = { customerId: 100, customerDisplayName: 'Клиент А' }
const PRICE_PER_HOUR_MINOR_UNITS = 1_000_000

export default function Prototype() {
  const [holdSeconds, setHoldSeconds] = useState(REAL_HOLD_SECONDS)

  // Remounting on a hold-length change gives a clean scenario rather than a
  // mix of holds with different lengths.
  return (
    <PrototypeRun
      key={holdSeconds}
      holdSeconds={holdSeconds}
      onHoldSecondsChange={setHoldSeconds}
    />
  )
}

interface Snapshot {
  mine: Reservation[]
  queue: Reservation[]
  cancellations: CancellationRequest[]
  availability: AvailabilityResponse
  serverTime: string
}

function PrototypeRun({
  holdSeconds,
  onHoldSecondsChange,
}: {
  holdSeconds: number
  onHoldSecondsChange: (seconds: number) => void
}) {
  const today = businessToday()

  const server = useMemo(() => {
    const instance = new FakeServer({ holdSeconds })
    // One pre-booked slot, so a conflict can be demonstrated without
    // choreography.
    instance.seedConfirmed({
      resourceIds: [11],
      startsAt: instantFor(today, '12:00'),
      endsAt: instantFor(today, '13:30'),
    })
    return instance
  }, [holdSeconds, today])

  const [date, setDate] = useState(today)
  const [duration, setDuration] = useState(90)

  const read = useCallback(
    (forDate: string, forDuration: number): Snapshot => {
      const own = server.list({ viewer: 'customer', customerId: CUSTOMER.customerId })
      const all = server.list({ viewer: 'employee' })

      return {
        mine: own.items,
        queue: all.items,
        cancellations: server.listCancellations('employee').items,
        availability: server.getAvailability(forDate, forDuration),
        serverTime: all.serverTime,
      }
    },
    [server],
  )

  // Lazy initializer rather than a mount effect: the first read happens before
  // the first paint, so no frame shows empty data.
  const [snapshot, setSnapshot] = useState<Snapshot>(() => read(today, 90))

  const [selected, setSelected] = useState<SlotSelection | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [conflict, setConflict] = useState<string | null>(null)
  const [queueNotice, setQueueNotice] = useState<{ title: string; message: string } | null>(null)
  const [selectedRequestId, setSelectedRequestId] = useState<number | null>(null)
  const [rejecting, setRejecting] = useState<Reservation | null>(null)
  const [justDecidedId, setJustDecidedId] = useState<number | null>(null)
  const [cancelling, setCancelling] = useState<Reservation | null>(null)
  const [cancelNotice, setCancelNotice] = useState<string | null>(null)
  const [decidingCancellation, setDecidingCancellation] = useState<{
    request: CancellationRequest
    outcome: 'approve' | 'reject'
  } | null>(null)
  const [selectedCancellationId, setSelectedCancellationId] = useState<number | null>(null)
  const [cancellationNotice, setCancellationNotice] = useState<{
    title: string
    message: string
  } | null>(null)

  const refresh = useCallback(() => {
    setSnapshot(read(date, duration))
  }, [read, date, duration])

  // The clock is the external system. State is set from the interval callback,
  // not from an effect observing a tick counter.
  //
  // A real client does not poll every second: it refreshes on focus, on
  // reconnect, and when a countdown reaches zero. One second here makes
  // expiry observable during a review session.
  useEffect(() => {
    const id = setInterval(() => setSnapshot(read(date, duration)), 1000)
    return () => clearInterval(id)
  }, [read, date, duration])

  function changeDate(next: string) {
    setDate(next)
    setSelected(null)
    setSnapshot(read(next, duration))
  }

  function changeDuration(next: number) {
    setDuration(next)
    // A duration change invalidates the chosen slot: its end time no longer
    // matches. Clearing it is safer than silently re-deriving one.
    setSelected(null)
    setSnapshot(read(date, next))
  }

  function submit() {
    if (!selected) return
    setSubmitting(true)
    setConflict(null)

    // One key per logical operation. A retry of the same attempt reuses it; a
    // fresh attempt after an explicit conflict is a new operation.
    const command = beginCommand()

    const result = server.createRequest({
      resourceIds: [selected.resourceId],
      startsAt: selected.startsAt,
      endsAt: selected.endsAt,
      idempotencyKey: command.key,
      ...CUSTOMER,
    })

    setSubmitting(false)
    setSelected(null)

    if (!result.ok) {
      setConflict(
        `Это время уже занято: ${result.conflicts
          .map((item) => item.resource_name)
          .join(', ')}. Выберите другое.`,
      )
    }

    setSnapshot(read(date, duration))
  }

  function confirm(reservation: Reservation) {
    setSubmitting(true)
    const result = server.confirm(reservation.id, reservation.version)
    setSubmitting(false)
    setJustDecidedId(reservation.id)

    setQueueNotice(
      result.ok ? null : { title: noticeTitle(result.code), message: noticeMessage(result.code) },
    )
    setSnapshot(read(date, duration))
  }

  function reject(reason: string | null) {
    if (!rejecting) return
    setSubmitting(true)
    const result = server.reject(rejecting.id, rejecting.version, reason)
    setSubmitting(false)
    setJustDecidedId(rejecting.id)
    setRejecting(null)

    setQueueNotice(
      result.ok ? null : { title: noticeTitle(result.code), message: noticeMessage(result.code) },
    )
    setSnapshot(read(date, duration))
  }

  function submitCancellation(reason: string | null) {
    if (!cancelling) return
    setSubmitting(true)
    const result = server.requestCancellation(cancelling.id, reason)
    setSubmitting(false)
    setCancelling(null)

    // The cutoff is the server's answer, not the client's. A refusal is
    // explained with the actual deadline rather than a generic failure.
    setCancelNotice(
      result.ok
        ? null
        : result.code === 'CANCELLATION_CUTOFF_PASSED'
          ? 'Срок истёк: отменить бронь можно не позднее чем за 2 часа до начала.'
          : 'Эту бронь нельзя отменить.',
    )
    setSnapshot(read(date, duration))
  }

  function decideCancellation(reason: string | null) {
    if (!decidingCancellation) return
    const { request, outcome } = decidingCancellation

    setSubmitting(true)
    const result =
      outcome === 'approve'
        ? server.approveCancellation(request.id, request.version, reason)
        : server.rejectCancellation(request.id, request.version, reason)
    setSubmitting(false)
    setDecidingCancellation(null)

    setCancellationNotice(
      result.ok
        ? null
        : {
            title: result.code === 'INVALID_TRANSITION' ? 'Запрос уже рассмотрен' : 'Данные устарели',
            message:
              result.code === 'INVALID_TRANSITION'
                ? 'Решение принял другой администратор. Показан итоговый статус.'
                : 'Запись изменилась. Обновите список и повторите.',
          },
    )
    setSnapshot(read(date, duration))
  }

  const pendingMine = snapshot.mine.find((item) => item.state === 'pending_confirmation')
  const settledMine = snapshot.mine.filter((item) => item.state !== 'pending_confirmation')
  const latestSettled = settledMine[0] ?? null

  // P10 is the *approval* queue: the contract filters it to
  // `state=pending_confirmation`, so a confirmed booking belongs on the
  // schedule (P09), not here.
  //
  // The one exception is the request this employee just decided. Keeping it
  // visible shows the committed outcome instead of the row vanishing from
  // under the cursor, which is what `ui-ux.md` section 6 asks for when a
  // decision succeeds.
  const queue = snapshot.queue.filter(
    (item) => item.state === 'pending_confirmation' || item.id === justDecidedId,
  )

  const selectedResourceName =
    snapshot.availability.resources.find((resource) => resource.id === selected?.resourceId)
      ?.name ?? ''

  const linePrice = Math.round((duration / 60) * PRICE_PER_HOUR_MINOR_UNITS)

  return (
    <div className="crm-page">
      <div className="crm-page__header">
        <div>
          <h1>Прототип journey P07–P10</h1>
          <p className="crm-meta" style={{ marginTop: 'var(--crm-space-1)' }}>
            Заявка → удержание 5 минут → решение сотрудника → результат ·
            только для разработки
          </p>
        </div>
        <ThemeSelect />
      </div>

      <div
        style={{ marginBottom: 'var(--crm-space-5)', display: 'grid', gap: 'var(--crm-space-3)' }}
      >
        <InlineAlert tone="warning" title="Это макет, а не работающая система">
          Данные не сохраняются, права не проверяются. Симуляция воспроизводит
          согласованные правила удержания, чтобы можно было оценить интерфейс,
          но не является эталонной реализацией — настоящие правила обеспечивает
          сервер.
        </InlineAlert>

        <label className="shell__field" style={{ maxWidth: 360 }}>
          <span className="shell__field-label">Длительность удержания</span>
          <select
            className="shell__control"
            value={holdSeconds}
            onChange={(event) => onHoldSecondsChange(Number(event.target.value))}
          >
            <option value={REAL_HOLD_SECONDS}>300 секунд — согласованное правило</option>
            <option value={20}>20 секунд — чтобы показать истечение</option>
          </select>
        </label>

        {holdSeconds !== REAL_HOLD_SECONDS && (
          <InlineAlert tone="error" title="Удержание сокращено для демонстрации">
            Согласованное правило (BR-04) — 5 минут. Значение {holdSeconds} секунд
            выбрано только для показа истечения и не является предложением
            изменить правило.
          </InlineAlert>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gap: 'var(--crm-space-6)',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
        }}
      >
        {/* --- customer ------------------------------------------------ */}
        <section>
          <h2 style={{ marginBottom: 'var(--crm-space-4)' }}>Клиент</h2>

          {pendingMine ? (
            <ReservationStatusCard reservation={pendingMine} onRefresh={refresh} />
          ) : (
            <>
              {conflict && (
                <div style={{ marginBottom: 'var(--crm-space-4)' }}>
                  <InlineAlert tone="warning" title="Время занято">
                    {conflict}
                  </InlineAlert>
                </div>
              )}

              {latestSettled && (
                <div style={{ marginBottom: 'var(--crm-space-4)' }}>
                  <ReservationStatusCard
                    reservation={latestSettled}
                    onChooseAnother={() => setConflict(null)}
                  />
                </div>
              )}

              <div className="booking">
                <AvailabilityPicker
                  availability={snapshot.availability}
                  durationMinutes={duration}
                  onDurationChange={changeDuration}
                  date={date}
                  onDateChange={changeDate}
                  selected={selected}
                  onSelect={setSelected}
                />

                {selected ? (
                  <RequestSummary
                    resourceName={selectedResourceName}
                    startsAt={selected.startsAt}
                    endsAt={selected.endsAt}
                    price={{
                      currency: 'KZT',
                      total_minor_units: linePrice,
                      lines: [
                        {
                          label: `Аренда корта, ${duration} минут`,
                          quantity: 1,
                          unit_price_minor_units: linePrice,
                          amount_minor_units: linePrice,
                        },
                      ],
                    }}
                    submitting={submitting}
                    onSubmit={submit}
                  />
                ) : (
                  <aside className="crm-panel booking__summary">
                    <p className="crm-muted">Выберите свободное время.</p>
                    <p className="crm-meta">
                      Выбор времени пока ничего не удерживает — удержание
                      начнётся после отправки заявки.
                    </p>
                  </aside>
                )}
              </div>
            </>
          )}

          <h3 style={{ margin: 'var(--crm-space-5) 0 var(--crm-space-3)' }}>Мои брони</h3>

          {/* A refused cancellation is explained with the real reason. The
              server decided it, so the message states the rule rather than
              blaming the user vaguely. */}
          {cancelNotice && (
            <div style={{ marginBottom: 'var(--crm-space-3)' }}>
              <InlineAlert
                tone="warning"
                title="Запрос на отмену не принят"
                action={{ label: 'Понятно', onClick: () => setCancelNotice(null) }}
              >
                {cancelNotice}
              </InlineAlert>
            </div>
          )}

          {snapshot.mine.length === 0 ? (
            <p className="crm-muted">Заявок пока нет.</p>
          ) : (
            <div style={{ display: 'grid', gap: 'var(--crm-space-3)' }}>
              {snapshot.mine.map((reservation) => (
                <ReservationStatusCard
                  key={reservation.id}
                  reservation={reservation}
                  onRequestCancellation={() => setCancelling(reservation)}
                />
              ))}
            </div>
          )}
        </section>

        {/* --- employee ------------------------------------------------ */}
        <section>
          <h2 style={{ marginBottom: 'var(--crm-space-4)' }}>Сотрудник</h2>
          <ApprovalQueue
            requests={queue}
            serverTime={snapshot.serverTime}
            selectedId={selectedRequestId}
            onSelect={setSelectedRequestId}
            onConfirm={confirm}
            onReject={setRejecting}
            submitting={submitting}
            notice={queueNotice}
            onRefresh={refresh}
          />

          <h3 style={{ margin: 'var(--crm-space-6) 0 var(--crm-space-3)' }}>
            Запросы на отмену (P11)
          </h3>
          <CancellationQueue
            requests={snapshot.cancellations}
            serverTime={snapshot.serverTime}
            selectedId={selectedCancellationId}
            onSelect={setSelectedCancellationId}
            onApprove={(request) => setDecidingCancellation({ request, outcome: 'approve' })}
            onReject={(request) => setDecidingCancellation({ request, outcome: 'reject' })}
            submitting={submitting}
            notice={cancellationNotice}
            onRefresh={refresh}
          />
        </section>
      </div>

      <DecisionDialog
        open={rejecting !== null}
        title="Отклонить заявку"
        consequence="Время будет освобождено и снова станет доступным для бронирования. Клиент увидит, что заявка отклонена."
        confirmLabel="Отклонить заявку"
        reasonPolicy="optional"
        submitting={submitting}
        onConfirm={reject}
        onCancel={() => setRejecting(null)}
      />

      {/* Customer-side review step. The consequence names what a customer
          most easily misreads: the booking stays live until an administrator
          approves, and no money comes back automatically. */}
      <DecisionDialog
        open={cancelling !== null}
        title="Запросить отмену брони"
        consequence="Бронь останется действующей, пока администратор не одобрит отмену. Отмена брони не оформляет возврат автоматически."
        confirmLabel="Запросить отмену"
        reasonPolicy="optional"
        reasonLabel="Причина отмены"
        submitting={submitting}
        onConfirm={submitCancellation}
        onCancel={() => setCancelling(null)}
      />

      <DecisionDialog
        open={decidingCancellation !== null}
        title={
          decidingCancellation?.outcome === 'approve' ? 'Одобрить отмену' : 'Отклонить запрос'
        }
        consequence={
          decidingCancellation?.outcome === 'approve'
            ? 'Бронь будет отменена, корт освободится. Возврат денег не оформляется автоматически.'
            : 'Бронь останется действующей, корт останется занятым. Деньги не затрагиваются.'
        }
        confirmLabel={
          decidingCancellation?.outcome === 'approve' ? 'Одобрить отмену' : 'Отклонить запрос'
        }
        reasonPolicy="optional"
        submitting={submitting}
        onConfirm={decideCancellation}
        onCancel={() => setDecidingCancellation(null)}
      />
    </div>
  )
}

function noticeTitle(code: string): string {
  switch (code) {
    case 'HOLD_EXPIRED':
      return 'Время удержания истекло'
    case 'INVALID_TRANSITION':
      return 'Заявку уже рассмотрели'
    case 'VERSION_CONFLICT':
      return 'Данные устарели'
    default:
      return 'Решение не принято'
  }
}

function noticeMessage(code: string): string {
  switch (code) {
    case 'HOLD_EXPIRED':
      return 'Заявку нельзя подтвердить. Время снова доступно для бронирования.'
    case 'INVALID_TRANSITION':
      return 'Решение принял другой сотрудник. Показан итоговый статус.'
    case 'VERSION_CONFLICT':
      return 'Запись изменилась. Обновите список и повторите.'
    default:
      return 'Попробуйте обновить список.'
  }
}
