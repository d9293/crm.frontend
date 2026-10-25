/**
 * Error taxonomy for the API client.
 *
 * Three outcomes must be distinguishable, because the correct recovery differs
 * for each and conflating them causes real damage:
 *
 *  - `ApiError`        the server replied and rejected the request. The
 *                      outcome is known. Safe to show the user a reason.
 *  - `NetworkError`    the request never reached a reply. For a read this is
 *                      harmless; for a mutation the outcome is UNKNOWN.
 *  - `TimeoutError`    a `NetworkError` where we gave up waiting. Also
 *                      unknown — the server may still have committed.
 *
 * The distinction drives UX-07: a payment whose response was lost must offer
 * outcome recovery, never a fresh payment. `ui-ux.md` section 10 requires
 * «Проверяем результат операции» plus a lookup or retry with the *same*
 * command key.
 */

import type { ApiError as ApiErrorBody } from './types'

/** Error codes from `development/README.md` section 8 plus the S1 additions. */
export const ERROR_CODE = {
  // Access
  notAuthenticated: 'NOT_AUTHENTICATED',
  forbidden: 'FORBIDDEN',
  invalidCredentials: 'INVALID_CREDENTIALS',
  accountBlocked: 'ACCOUNT_BLOCKED',
  rateLimited: 'RATE_LIMITED',

  // Generic
  notFound: 'NOT_FOUND',
  validationFailed: 'VALIDATION_FAILED',
  versionConflict: 'VERSION_CONFLICT',

  // Domain
  slotUnavailable: 'SLOT_UNAVAILABLE',
  holdExpired: 'HOLD_EXPIRED',
  cancellationCutoffPassed: 'CANCELLATION_CUTOFF_PASSED',
  invalidTransition: 'INVALID_TRANSITION',
  capacityExceeded: 'CAPACITY_EXCEEDED',
  paymentAlreadyApplied: 'PAYMENT_ALREADY_APPLIED',
  refundLimitExceeded: 'REFUND_LIMIT_EXCEEDED',

  // S1 additions
  lastPowerUserProtected: 'LAST_POWER_USER_PROTECTED',
  resourceLocationMismatch: 'RESOURCE_LOCATION_MISMATCH',
  closureConflictsBookings: 'CLOSURE_CONFLICTS_BOOKINGS',
} as const

/** The server replied and rejected the request. The outcome is known. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly fieldErrors: Record<string, string[]>
  readonly currentVersion: number | undefined
  readonly correlationId: string | undefined
  /** Full body, for codes carrying extra detail such as closure conflicts. */
  readonly body: unknown

  constructor(status: number, body: Partial<ApiErrorBody> & Record<string, unknown>) {
    super(body.message ?? `Запрос отклонён (${status})`)
    this.name = 'ApiError'
    this.status = status
    this.code = body.code ?? 'UNKNOWN'
    this.fieldErrors = (body.field_errors as Record<string, string[]>) ?? {}
    this.currentVersion = body.current_version as number | undefined
    this.correlationId = body.correlation_id as string | undefined
    this.body = body
  }

  is(...codes: string[]): boolean {
    return codes.includes(this.code)
  }

  /** 401. The caller should clear protected views and caches. */
  get isSessionExpired(): boolean {
    return this.status === 401
  }

  /** 409 on a version check. The record changed under the user. */
  get isVersionConflict(): boolean {
    return this.code === ERROR_CODE.versionConflict
  }

  /** 422 or 400 with per-field detail, for form display. */
  get isValidation(): boolean {
    return Object.keys(this.fieldErrors).length > 0
  }
}

/**
 * The request produced no reply.
 *
 * `outcomeUnknown` is the important field. For a GET it is false — nothing was
 * changed, so retrying is free. For a mutation it is true: the server may have
 * committed before the connection failed, and the only safe recovery is to
 * look up the result or retry with the identical idempotency key.
 */
export class NetworkError extends Error {
  readonly outcomeUnknown: boolean
  readonly cause: unknown

  constructor(message: string, outcomeUnknown: boolean, cause?: unknown) {
    super(message)
    this.name = 'NetworkError'
    this.outcomeUnknown = outcomeUnknown
    this.cause = cause
  }
}

export class TimeoutError extends NetworkError {
  constructor(outcomeUnknown: boolean) {
    super('Превышено время ожидания ответа', outcomeUnknown)
    this.name = 'TimeoutError'
  }
}

/**
 * True when a failed mutation's result is genuinely unknown.
 *
 * Guard every "try again" affordance on a financial or booking command with
 * this. If it returns true the user must be offered recovery of the original
 * operation, not a new one.
 */
export function isOutcomeUnknown(error: unknown): boolean {
  return error instanceof NetworkError && error.outcomeUnknown
}

/** Russian message safe to display for any client error. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) return error.message
  if (error instanceof TimeoutError) return 'Сервер не ответил. Проверяем результат операции.'
  if (error instanceof NetworkError) {
    return error.outcomeUnknown
      ? 'Нет соединения. Результат операции неизвестен.'
      : 'Нет соединения. Повторите попытку.'
  }
  return 'Произошла непредвиденная ошибка.'
}
