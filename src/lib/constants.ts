// Stati applicativi del layer custom.
// SQLite non supporta enum nativi in Prisma, quindi i campi status sono
// stringhe in DB vincolate qui a livello di codice.

export const CLIENT_STATUS = {
  ACTIVE: "ACTIVE",
  PAUSED: "PAUSED",
} as const;
export type ClientStatus = (typeof CLIENT_STATUS)[keyof typeof CLIENT_STATUS];

// Stati minimi richiesti dal business (Prompt Master sezione 3.5)
export const BOOKING_STATUS = {
  PENDING_APPROVAL: "PENDING_APPROVAL",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
  RESCHEDULE_REQUESTED: "RESCHEDULE_REQUESTED",
  RESCHEDULED: "RESCHEDULED",
} as const;
export type BookingStatus = (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];

// Stati che occupano un posto nello slot ai fini della capacita'
export const ACTIVE_BOOKING_STATUSES: BookingStatus[] = [
  BOOKING_STATUS.PENDING_APPROVAL,
  BOOKING_STATUS.APPROVED,
  BOOKING_STATUS.RESCHEDULE_REQUESTED,
  BOOKING_STATUS.RESCHEDULED,
];

export const RESCHEDULE_STATUS = {
  PENDING: "PENDING",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
} as const;
export type RescheduleStatus = (typeof RESCHEDULE_STATUS)[keyof typeof RESCHEDULE_STATUS];
