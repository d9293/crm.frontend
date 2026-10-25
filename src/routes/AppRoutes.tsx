/**
 * Route table for the full P01–P21 page inventory.
 *
 * Routes follow `development/README.md` section 4. They are proposed there,
 * not owner-approved, so treat a path change as a specification change rather
 * than a refactor — `ui-ux.md` section 10 allows non-sensitive date, status
 * and location filters in URL query parameters, so these paths will be linked
 * and bookmarked.
 *
 * Every page is reachable now, behind the real guards, so navigation,
 * permissions, shells and responsive behaviour can be reviewed in S0 before
 * any page has content.
 */

import { Navigate, Route, Routes } from 'react-router'
import { useAuth } from '../auth/context'
import { CAPABILITY, type Capability } from '../api/types'
import StaffShell from '../shells/StaffShell'
import CustomerShell from '../shells/CustomerShell'
import CoachShell from '../shells/CoachShell'
import LoginPage from '../pages/LoginPage'
import PlaceholderPage from '../pages/PlaceholderPage'
import Gallery from '../dev/Gallery'
import { NotFound, RequireAuth, RequireCapability } from './guards'

interface PageSpec {
  path: string
  pageId: string
  title: string
  ticket: string
  sprint: string
  template: string
  anyOf: Capability[]
  gates?: string[]
}

/** Staff pages, rendered inside `StaffShell`. */
const STAFF_PAGES: PageSpec[] = [
  {
    path: 'schedule',
    pageId: 'P09',
    title: 'Расписание',
    ticket: 'FE-09',
    sprint: 'S3–S4',
    template: 'T3',
    anyOf: [CAPABILITY.reservationsRead],
  },
  {
    path: 'reservation-requests',
    pageId: 'P10',
    title: 'Заявки на бронь',
    ticket: 'FE-10',
    sprint: 'S3',
    template: 'T4',
    anyOf: [CAPABILITY.reservationsConfirm, CAPABILITY.reservationsReject],
  },
  {
    path: 'cancellation-requests',
    pageId: 'P11',
    title: 'Запросы на отмену',
    ticket: 'FE-11',
    sprint: 'S4',
    template: 'T4',
    anyOf: [CAPABILITY.cancellationsDecide],
    gates: ['D-07'],
  },
  {
    path: 'customers',
    pageId: 'P04',
    title: 'Клиенты',
    ticket: 'FE-04',
    sprint: 'S2',
    template: 'T2',
    anyOf: [CAPABILITY.customersManage],
    gates: ['D-02', 'D-05'],
  },
  {
    path: 'customers/:customerId',
    pageId: 'P04',
    title: 'Клиент',
    ticket: 'FE-04',
    sprint: 'S2',
    template: 'T5',
    anyOf: [CAPABILITY.customersManage],
    gates: ['D-02', 'D-05'],
  },
  {
    path: 'coaches',
    pageId: 'P05',
    title: 'Тренеры',
    ticket: 'FE-05',
    sprint: 'S2',
    template: 'T2',
    anyOf: [CAPABILITY.customersManage],
    gates: ['D-04'],
  },
  {
    path: 'services',
    pageId: 'P06',
    title: 'Услуги и тарифы',
    ticket: 'FE-06',
    sprint: 'S2',
    template: 'T2',
    anyOf: [CAPABILITY.servicesManage],
    gates: ['D-10'],
  },
  {
    path: 'groups',
    pageId: 'P13',
    title: 'Группы',
    ticket: 'FE-14',
    sprint: 'S6',
    template: 'T2',
    anyOf: [CAPABILITY.groupsManage],
    gates: ['D-08', 'D-12'],
  },
  {
    path: 'groups/:groupId',
    pageId: 'P13',
    title: 'Группа',
    ticket: 'FE-14',
    sprint: 'S6',
    template: 'T5',
    anyOf: [CAPABILITY.groupsManage],
    gates: ['D-08', 'D-12'],
  },
  {
    path: 'memberships',
    pageId: 'P14',
    title: 'Абонементы',
    ticket: 'FE-15',
    sprint: 'S6',
    template: 'T2',
    anyOf: [CAPABILITY.customersManage],
    gates: ['D-10', 'D-11'],
  },
  {
    path: 'memberships/:membershipId',
    pageId: 'P14',
    title: 'Абонемент',
    ticket: 'FE-15',
    sprint: 'S6',
    template: 'T5',
    anyOf: [CAPABILITY.customersManage],
    gates: ['D-10', 'D-11'],
  },
  {
    path: 'saved-lessons',
    pageId: 'P16',
    title: 'Сохранённые занятия',
    ticket: 'FE-17',
    sprint: 'S7',
    template: 'T2',
    anyOf: [CAPABILITY.savedLessonsResolve],
    gates: ['D-12'],
  },
  {
    path: 'finance',
    pageId: 'P12',
    title: 'Платежи',
    ticket: 'FE-13',
    sprint: 'S5',
    template: 'T7',
    anyOf: [CAPABILITY.financeRead, CAPABILITY.paymentsReceive],
    gates: ['D-09'],
  },
  {
    path: 'reports',
    pageId: 'P17',
    title: 'Отчёты и выгрузки',
    ticket: 'FE-18',
    sprint: 'S8',
    template: 'T7',
    anyOf: [CAPABILITY.financeRead, CAPABILITY.reportsExport],
    gates: ['D-14'],
  },
  {
    path: 'coach-statements',
    pageId: 'P18',
    title: 'Ведомости тренеров',
    ticket: 'FE-19',
    sprint: 'S8',
    template: 'T7',
    anyOf: [CAPABILITY.financeRead],
    gates: ['D-13'],
  },
  {
    path: 'payroll',
    pageId: 'P19',
    title: 'Зарплата',
    ticket: 'FE-20',
    sprint: 'S8',
    template: 'T7',
    anyOf: [CAPABILITY.payrollApprove, CAPABILITY.payrollRecordPayout],
    gates: ['D-13'],
  },
  {
    path: 'employees',
    pageId: 'P02',
    title: 'Сотрудники и права',
    ticket: 'FE-02',
    sprint: 'S1',
    template: 'T2',
    anyOf: [CAPABILITY.employeesManage, CAPABILITY.permissionsManage],
    gates: ['D-04'],
  },
  {
    path: 'locations',
    pageId: 'P03',
    title: 'Локации и ресурсы',
    ticket: 'FE-03',
    sprint: 'S1',
    template: 'T2',
    anyOf: [CAPABILITY.locationsManage, CAPABILITY.resourcesManage],
    gates: ['D-05', 'D-06'],
  },
  {
    path: 'resources',
    pageId: 'P03',
    title: 'Ресурсы',
    ticket: 'FE-03',
    sprint: 'S1',
    template: 'T2',
    anyOf: [CAPABILITY.resourcesManage],
    gates: ['D-06'],
  },
  {
    path: 'reminders',
    pageId: 'P20',
    title: 'Настройки напоминаний',
    ticket: 'FE-21',
    sprint: 'S9',
    template: 'T9',
    anyOf: [CAPABILITY.employeesManage],
    gates: ['D-15'],
  },
  {
    path: 'audit',
    pageId: 'P21',
    title: 'Журнал действий',
    ticket: 'FE-22',
    sprint: 'S9',
    template: 'T9',
    anyOf: [CAPABILITY.auditRead],
  },
]

const CUSTOMER_PAGES: PageSpec[] = [
  {
    path: 'availability',
    pageId: 'P07',
    title: 'Забронировать корт',
    ticket: 'FE-07',
    sprint: 'S3',
    template: 'T6',
    anyOf: [CAPABILITY.reservationsRequest],
  },
  {
    path: 'reservations',
    pageId: 'P08',
    title: 'Мои брони',
    ticket: 'FE-08',
    sprint: 'S3–S4',
    template: 'T2',
    anyOf: [CAPABILITY.reservationsReadOwn],
  },
  {
    path: 'reservations/:reservationId',
    pageId: 'P08',
    title: 'Бронь',
    ticket: 'FE-08',
    sprint: 'S3–S4',
    template: 'T5',
    anyOf: [CAPABILITY.reservationsReadOwn],
  },
]

const COACH_PAGES: PageSpec[] = [
  {
    path: 'schedule',
    pageId: 'P15',
    title: 'Моё расписание',
    ticket: 'FE-16',
    sprint: 'S7',
    template: 'T8',
    anyOf: [CAPABILITY.sessionsReadOwn],
  },
  {
    path: 'sessions/:sessionId',
    pageId: 'P15',
    title: 'Состав занятия',
    ticket: 'FE-16',
    sprint: 'S7',
    template: 'T8',
    anyOf: [CAPABILITY.rostersReadOwn],
    gates: ['D-12'],
  },
]

function renderPage(spec: PageSpec) {
  return (
    <Route
      key={`${spec.pageId}-${spec.path}`}
      path={spec.path}
      element={
        <RequireCapability anyOf={spec.anyOf}>
          <PlaceholderPage
            pageId={spec.pageId}
            title={spec.title}
            ticket={spec.ticket}
            sprint={spec.sprint}
            template={spec.template}
            gates={spec.gates}
          />
        </RequireCapability>
      }
    />
  )
}

/**
 * Landing route per role.
 *
 * Staff land on the schedule for the selected permitted location; customers on
 * availability; coaches on their own schedule. Section 2 of `ui-ux.md` sets
 * these, and FE-01 requires sign-in to route by role.
 */
function RoleLanding() {
  const { user, status } = useAuth()

  if (status === 'loading') return null
  if (!user) return <Navigate to="/login" replace />

  switch (user.role) {
    case 'customer':
      return <Navigate to="/customer/availability" replace />
    case 'coach':
      return <Navigate to="/coach/schedule" replace />
    default:
      return <Navigate to="/staff/schedule" replace />
  }
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RoleLanding />} />

      <Route
        path="/staff"
        element={
          <RequireAuth>
            <StaffShell />
          </RequireAuth>
        }
      >
        {STAFF_PAGES.map(renderPage)}
      </Route>

      <Route
        path="/customer"
        element={
          <RequireAuth>
            <CustomerShell />
          </RequireAuth>
        }
      >
        {CUSTOMER_PAGES.map(renderPage)}
      </Route>

      <Route
        path="/coach"
        element={
          <RequireAuth>
            <CoachShell />
          </RequireAuth>
        }
      >
        {COACH_PAGES.map(renderPage)}
      </Route>

      {/*
        P20 notifications and P01 account are scoped to any signed-in user, so
        they sit outside the role shells. The notification inbox is scoped by
        the server to what the actor may see (BE-19).
      */}
      <Route
        path="/notifications"
        element={
          <RequireAuth>
            <PlaceholderPage
              pageId="P20"
              title="Уведомления"
              ticket="FE-21"
              sprint="S9"
              template="T2"
              gates={['D-15']}
            />
          </RequireAuth>
        }
      />
      <Route
        path="/account"
        element={
          <RequireAuth>
            <PlaceholderPage
              pageId="P01"
              title="Учётная запись"
              ticket="FE-01"
              sprint="S1"
              template="T1"
              gates={['D-02']}
            />
          </RequireAuth>
        }
      />

      {/*
        Component state gallery for the S0 design review. The condition is
        statically false in a production build, so Vite removes both this route
        and the Gallery module. It is deliberately outside RequireAuth: it
        renders only synthetic data and must be reviewable without a session.
      */}
      {import.meta.env.DEV && <Route path="/dev/gallery" element={<Gallery />} />}

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}
