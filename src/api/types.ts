/**
 * Named aliases over the generated contract types.
 *
 * `schema.d.ts` is generated from `../crm.backend/api/openapi.yaml` by
 * `npm run api:types` and must not be hand-edited. This module gives the
 * handful of types used across the application readable names, so components
 * do not spell `components['schemas']['CurrentUser']` everywhere and a
 * contract rename surfaces here rather than in fifty files.
 */

import type { components } from './schema'

type Schemas = components['schemas']

export type CurrentUser = Schemas['CurrentUser']
export type RoleKey = Schemas['RoleKey']
export type Capability = Schemas['Capability']
export type LocationSummary = Schemas['LocationSummary']
export type Location = Schemas['Location']
export type Resource = Schemas['Resource']
export type Employee = Schemas['Employee']
export type EmployeeSummary = Schemas['EmployeeSummary']
export type AccessState = Schemas['AccessState']
export type ApiError = Schemas['Error']
export type Closure = Schemas['Closure']

// S3 — availability and reservations
export type Reservation = Schemas['Reservation']
export type ReservationSummary = Schemas['ReservationSummary']
export type ReservationState = Schemas['ReservationState']
export type ResourceAllocation = Schemas['ResourceAllocation']
export type AvailabilityResponse = Schemas['AvailabilityResponse']
export type AvailabilitySlot = Schemas['AvailabilitySlot']
export type DurationOption = Schemas['DurationOption']
export type PriceSnapshot = Schemas['PriceSnapshot']
export type PriceLine = Schemas['PriceLine']
export type FinancialSummary = Schemas['FinancialSummary']
export type CancellationState = Schemas['CancellationState']
export type MinorUnits = Schemas['MinorUnits']
export type SlotConflictError = Schemas['SlotConflictError']
export type ReservationConflictError = Schemas['ReservationConflictError']

/**
 * Capability keys referenced by the navigation and route guards.
 *
 * The contract deliberately types `Capability` as an open string rather than an
 * enum, because the set grows every sprint. These constants cover only what S1
 * navigation needs; the authoritative catalogue comes from
 * `GET /meta/capabilities`.
 *
 * Nothing here grants anything. The server enforces every call independently —
 * these values only decide what is worth rendering.
 */
export const CAPABILITY = {
  // Administration
  employeesManage: 'employees.manage',
  permissionsManage: 'permissions.manage',
  locationsManage: 'locations.manage',
  resourcesManage: 'resources.manage',
  servicesManage: 'services.manage',
  customersManage: 'customers.manage',
  groupsManage: 'groups.manage',

  // Scheduling
  reservationsRead: 'reservations.read',
  reservationsCreate: 'reservations.create',
  reservationsEdit: 'reservations.edit',
  reservationsConfirm: 'reservations.confirm',
  reservationsReject: 'reservations.reject',
  cancellationsDecide: 'cancellations.decide',

  // Customer self-service
  reservationsRequest: 'reservations.request',
  reservationsReadOwn: 'reservations.read_own',
  cancellationsRequestOwn: 'cancellations.request_own',

  // Coach
  sessionsReadOwn: 'sessions.read_own',
  rostersReadOwn: 'rosters.read_own',
  attendanceManage: 'attendance.manage',
  savedLessonsResolve: 'saved_lessons.resolve',

  // Finance
  paymentsReceive: 'payments.receive',
  financeRead: 'finance.read',
  refundsIssue: 'refunds.issue',
  reportsExport: 'reports.export',

  // Payroll and audit
  payrollApprove: 'payroll.approve',
  payrollRecordPayout: 'payroll.record_payout',
  auditRead: 'audit.read',
} as const satisfies Record<string, Capability>

export type CapabilityKey = (typeof CAPABILITY)[keyof typeof CAPABILITY]
