/**
 * Synthetic users for the S0 design review.
 *
 * `ui-ux.md` section 12 lists the three role shells and a template gallery as
 * S0 deliverables, which means they have to be reachable before any
 * authentication endpoint exists. These fixtures make that possible.
 *
 * Two constraints on this file:
 *
 *  - It is imported only by dev-gated code and never ships in a production
 *    bundle. See the `import.meta.env.DEV` guard in `LoginPage`.
 *  - The data is invented. No real customer, employee or demo record appears
 *    here, and none should ever be added — `business-demo-review.md` records
 *    that no personal demo records are included in these deliverables.
 *
 * Selecting a preview user grants nothing. The server authorizes every call
 * independently; this only exercises which navigation and guards render.
 */

import { CAPABILITY, type CurrentUser } from '../api/types'

const ACE = { id: 1, name: 'ACE' }
const CSKA = { id: 2, name: 'CSKA' }

export interface PreviewUser {
  key: string
  label: string
  /** What this fixture is useful for reviewing. */
  purpose: string
  user: CurrentUser
}

const serverTime = '2026-10-25T09:00:00Z'

export const PREVIEW_USERS: PreviewUser[] = [
  {
    key: 'power_user',
    label: 'Полные права (Power User)',
    purpose: 'Все четыре группы навигации, обе локации.',
    user: {
      id: 1,
      full_name: 'Владелец клуба',
      role: 'power_user',
      capabilities: Object.values(CAPABILITY),
      locations: [ACE, CSKA],
      server_time: serverTime,
    },
  },
  {
    key: 'operator_ace',
    label: 'Оператор, только ACE',
    purpose:
      'Проверка UX-05 и AC-11: одна локация, нет финансов, нет администрирования.',
    user: {
      id: 2,
      full_name: 'Оператор ACE',
      role: 'operator',
      capabilities: [
        CAPABILITY.reservationsRead,
        CAPABILITY.reservationsCreate,
        CAPABILITY.reservationsConfirm,
        CAPABILITY.reservationsReject,
        CAPABILITY.customersManage,
      ],
      locations: [ACE],
      server_time: serverTime,
    },
  },
  {
    key: 'coach',
    label: 'Тренер без доступа к финансам',
    purpose:
      'Оболочка тренера: только свои занятия, раздел начислений отсутствует.',
    user: {
      id: 3,
      full_name: 'Тренер ACE',
      role: 'coach',
      capabilities: [
        CAPABILITY.sessionsReadOwn,
        CAPABILITY.rostersReadOwn,
        CAPABILITY.attendanceManage,
      ],
      locations: [ACE],
      coach_id: 10,
      server_time: serverTime,
    },
  },
  {
    key: 'customer',
    label: 'Клиент',
    purpose: 'Клиентская оболочка: две цели, нижняя навигация на телефоне.',
    user: {
      id: 4,
      full_name: 'Клиент клуба',
      role: 'customer',
      capabilities: [
        CAPABILITY.reservationsRequest,
        CAPABILITY.reservationsReadOwn,
        CAPABILITY.cancellationsRequestOwn,
      ],
      locations: [ACE, CSKA],
      customer_id: 100,
      server_time: serverTime,
    },
  },
]
