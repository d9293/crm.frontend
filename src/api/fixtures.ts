/**
 * Contract fixtures: success, validation, forbidden and conflict.
 *
 * FE-00 requires representative fixtures for these four response shapes, to be
 * used only while a backend endpoint is being completed. Two standing rules:
 *
 *  - `frontend.md` is explicit that a ticket must not be closed on mocked data
 *    alone. A fixture proves the client handles a shape; it proves nothing
 *    about whether the server produces it.
 *  - All data is invented. No real customer, employee or demo record appears
 *    here.
 *
 * Shapes are typed against the generated contract, so a contract change breaks
 * these at compile time rather than leaving the app coded against a response
 * the server no longer sends.
 */

import type { ApiError, CurrentUser, Employee, Location, Resource } from './types'
import { CAPABILITY } from './types'
import { ERROR_CODE } from './errors'

const SERVER_TIME = '2026-10-25T09:00:00Z'

export const fixtureLocations: Location[] = [
  {
    id: 1,
    name: 'ACE',
    timezone: 'Asia/Almaty',
    address: null,
    is_active: true,
    version: 1,
  },
  {
    id: 2,
    name: 'CSKA',
    timezone: 'Asia/Almaty',
    address: null,
    is_active: true,
    version: 1,
  },
]

export const fixtureCurrentUser: CurrentUser = {
  id: 1,
  full_name: 'Администратор ACE',
  role: 'administrator',
  capabilities: [
    CAPABILITY.reservationsRead,
    CAPABILITY.reservationsConfirm,
    CAPABILITY.reservationsReject,
    CAPABILITY.cancellationsDecide,
    CAPABILITY.customersManage,
  ],
  locations: [{ id: 1, name: 'ACE' }],
  server_time: SERVER_TIME,
}

export const fixtureEmployee: Employee = {
  id: 7,
  full_name: 'Оператор смены',
  role: 'operator',
  access_state: 'active',
  locations: [{ id: 1, name: 'ACE' }],
  version: 3,
  phone: '+7 700 000 00 00',
  capabilities: [CAPABILITY.reservationsRead, CAPABILITY.reservationsConfirm],
  coach_id: null,
  active_session_count: 2,
  created_at: '2026-09-01T04:00:00Z',
  archived_at: null,
}

export const fixtureResource: Resource = {
  id: 11,
  location_id: 1,
  name: 'Корт 1',
  kind: 'tennis_court',
  placement: 'indoor',
  display_order: 1,
  default_capacity: 12,
  is_active: true,
  // 07:00 to 00:00: the close belongs to the next calendar date, carried by
  // the explicit flag rather than a "24:00" string.
  opening_hours: [
    { weekday: 1, opens_at: '07:00', closes_at: '00:00', closes_next_day: true },
    { weekday: 2, opens_at: '07:00', closes_at: '00:00', closes_next_day: true },
  ],
  version: 2,
  archived_at: null,
}

/* --- error fixtures ------------------------------------------------------ */

export const fixtureValidationError: ApiError = {
  code: ERROR_CODE.validationFailed,
  message: 'Проверьте заполненные поля.',
  field_errors: {
    full_name: ['Укажите имя сотрудника.'],
    location_ids: ['Выберите хотя бы одну локацию.'],
  },
  correlation_id: '018f3a2c-7b11-7c3e-9a44-6d2f1b8e5ca2',
}

export const fixtureForbiddenError: ApiError = {
  code: ERROR_CODE.forbidden,
  message: 'Недостаточно прав для этого действия.',
  correlation_id: '018f3a2c-7b11-7c3e-9a44-6d2f1b8e5ca1',
}

export const fixtureVersionConflictError: ApiError = {
  code: ERROR_CODE.versionConflict,
  message: 'Запись изменена другим пользователем. Обновите данные.',
  current_version: 4,
  correlation_id: '018f3a2c-7b11-7c3e-9a44-6d2f1b8e5ca3',
}

export const fixtureLastPowerUserError: ApiError = {
  code: ERROR_CODE.lastPowerUserProtected,
  message: 'Нельзя снять последнего пользователя с полными правами.',
  correlation_id: '018f3a2c-7b11-7c3e-9a44-6d2f1b8e5c93',
}

/**
 * Closure conflict, including the extra `conflicts` array the contract defines
 * for this code. The UI must be able to name the exact conflicting dates
 * rather than reporting a generic failure.
 */
export const fixtureClosureConflictError = {
  code: ERROR_CODE.closureConflictsBookings,
  message: 'В выбранный период есть подтверждённые брони.',
  correlation_id: '018f3a2c-7b11-7c3e-9a44-6d2f1b8e5c94',
  conflicts: [
    {
      reservation_id: 4821,
      starts_at: '2026-11-02T04:00:00Z',
      ends_at: '2026-11-02T05:30:00Z',
    },
  ],
}

/** Hold response pair, for exercising the countdown. */
export const fixtureHold = {
  server_time: SERVER_TIME,
  hold_expires_at: '2026-10-25T09:05:00Z',
}
