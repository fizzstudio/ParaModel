import { Temporal } from "temporal-polyfill";

export type DatePeriod = {
  type: 'date',
  start: Temporal.PlainDateTime,
  duration: Temporal.Duration
}

export type RecurringPeriod = {
  type: 'recurring',
  start: Temporal.PlainDateTime,
  part: Temporal.Duration,
  whole: Temporal.Duration
}

export type DateValue = DatePeriod | RecurringPeriod;