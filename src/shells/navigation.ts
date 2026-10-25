/**
 * Staff navigation structure.
 *
 * Mirrors the four groups in `development/ui-ux.md` section 2, in that order.
 * Kept as data so the structure can be reviewed against the specification
 * without reading JSX, and so a group can be reordered in one place.
 *
 * `anyOf` lists the capabilities that make a destination worth rendering. Only
 * authorized destinations are rendered — but that is a presentation decision,
 * not access control: the server enforces every call, and a user who reaches a
 * route by typing its URL still gets a denial from the API.
 *
 * Where section 7 does not name a capability for a page, the closest listed
 * grant is used and marked. Exact role defaults and delegated permissions are
 * D-04; none of these mappings should be treated as approved policy.
 */

import { CAPABILITY, type Capability } from '../api/types'

export interface NavItem {
  label: string
  to: string
  /** Rendered when the user holds at least one of these. */
  anyOf: Capability[]
  /** Shows a count badge — active request queues only. */
  showsActiveCount?: boolean
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const STAFF_NAVIGATION: NavGroup[] = [
  {
    label: 'Ежедневная работа',
    items: [
      {
        label: 'Расписание',
        to: '/staff/schedule',
        anyOf: [CAPABILITY.reservationsRead],
      },
      {
        label: 'Заявки на бронь',
        to: '/staff/reservation-requests',
        anyOf: [CAPABILITY.reservationsConfirm, CAPABILITY.reservationsReject],
        showsActiveCount: true,
      },
      {
        label: 'Запросы на отмену',
        to: '/staff/cancellation-requests',
        anyOf: [CAPABILITY.cancellationsDecide],
        showsActiveCount: true,
      },
    ],
  },
  {
    label: 'Клиенты и тренировки',
    items: [
      {
        label: 'Клиенты',
        to: '/staff/customers',
        anyOf: [CAPABILITY.customersManage],
      },
      {
        label: 'Группы',
        to: '/staff/groups',
        anyOf: [CAPABILITY.groupsManage],
      },
      {
        // Section 7 names no memberships capability. Membership issuance is a
        // customer-facing action, so customers.manage is used as the closest
        // listed grant. GATE D-04.
        label: 'Абонементы',
        to: '/staff/memberships',
        anyOf: [CAPABILITY.customersManage],
      },
      {
        // Section 7 names no coaches capability either; BE-04 covers coaches
        // alongside customers. GATE D-04.
        label: 'Тренеры',
        to: '/staff/coaches',
        anyOf: [CAPABILITY.customersManage],
      },
      {
        label: 'Сохранённые занятия',
        to: '/staff/saved-lessons',
        anyOf: [CAPABILITY.savedLessonsResolve],
      },
    ],
  },
  {
    label: 'Финансы',
    items: [
      {
        label: 'Платежи',
        to: '/staff/finance',
        anyOf: [CAPABILITY.financeRead, CAPABILITY.paymentsReceive],
      },
      {
        label: 'Отчёты',
        to: '/staff/reports',
        anyOf: [CAPABILITY.financeRead, CAPABILITY.reportsExport],
      },
      {
        label: 'Ведомости тренеров',
        to: '/staff/coach-statements',
        anyOf: [CAPABILITY.financeRead],
      },
      {
        label: 'Зарплата',
        to: '/staff/payroll',
        anyOf: [CAPABILITY.payrollApprove, CAPABILITY.payrollRecordPayout],
      },
    ],
  },
  {
    label: 'Администрирование',
    items: [
      {
        label: 'Сотрудники',
        to: '/staff/employees',
        anyOf: [CAPABILITY.employeesManage, CAPABILITY.permissionsManage],
      },
      {
        label: 'Локации и ресурсы',
        to: '/staff/locations',
        anyOf: [CAPABILITY.locationsManage, CAPABILITY.resourcesManage],
      },
      {
        label: 'Услуги',
        to: '/staff/services',
        anyOf: [CAPABILITY.servicesManage],
      },
      {
        label: 'Журнал действий',
        to: '/staff/audit',
        anyOf: [CAPABILITY.auditRead],
      },
    ],
  },
]

/**
 * Customer shell: exactly two primary destinations.
 *
 * Section 2 is explicit that there is no invented customer dashboard, and that
 * membership and payment-profile pages are deferred under D-03.
 */
export const CUSTOMER_NAVIGATION: NavItem[] = [
  {
    label: 'Забронировать корт',
    to: '/customer/availability',
    anyOf: [CAPABILITY.reservationsRequest],
  },
  {
    label: 'Мои брони',
    to: '/customer/reservations',
    anyOf: [CAPABILITY.reservationsReadOwn],
  },
]

/**
 * Coach shell: upcoming sessions and rosters first. An earnings destination
 * appears only with an explicit finance grant.
 */
export const COACH_NAVIGATION: NavItem[] = [
  {
    label: 'Моё расписание',
    to: '/coach/schedule',
    anyOf: [CAPABILITY.sessionsReadOwn],
  },
  {
    label: 'Сохранённые занятия',
    to: '/staff/saved-lessons',
    anyOf: [CAPABILITY.savedLessonsResolve],
  },
  {
    label: 'Мои начисления',
    to: '/staff/coach-statements',
    anyOf: [CAPABILITY.financeRead],
  },
]
