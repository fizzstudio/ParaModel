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

// @simonvarey: This is a temp fix until ParaLoader outputs standard datetime strings
const QUARTER_START_MONTHS = ['01', '04', '07', '10']

// @simonvarey: This is a temp fix until ParaLoader outputs standard datetime strings
export function parseDateToStandardFormat(input: string): string | null {
  let yearNumber = parseFloat(input);
  let quarterNumber = 0;
  const isQuarter = input[0] === 'Q';
  if (isQuarter) {
    quarterNumber = parseInt(input[1]) - 1;
    if (input[3] === "'") {
      yearNumber = parseInt(input.substring(4)) + 2000;
    } else {
      yearNumber = parseInt(input.substring(3));
    }
  }
  if (Number.isNaN(yearNumber) || Number.isNaN(quarterNumber)) {
    return null;
  }
  const duration = `P${isQuarter ? '3M' : '1Y'}`;
  return `${yearNumber}${QUARTER_START_MONTHS[quarterNumber]}01${duration}`
}

// TODO: Add support for Recurring Periods
export function convertStandardFormatToDateValue(rfc9557iso8601: string): DateValue {
  const [rfc9557, iso8601] = rfc9557iso8601.split('P');
  return {
    type: 'date',
    start: Temporal.PlainDateTime.from(rfc9557),
    duration: Temporal.Duration.from('P' + iso8601)
  };
}

export function compareDateValues(lhs: DateValue, rhs: DateValue): boolean {
  if (lhs.type === 'date' && rhs.type === 'date') {
    if (Temporal.PlainDateTime.compare(lhs.start, rhs.start) !== 0) {
      return false;
    }
    return Temporal.Duration.compare(lhs.duration, rhs.duration) !== 0
  }
  if (lhs.type === 'recurring' && rhs.type === 'recurring') {
    if (Temporal.PlainDateTime.compare(lhs.start, rhs.start) !== 0) {
      return false;
    }
    if (Temporal.Duration.compare(lhs.part, rhs.part) !== 0) {
      return false;
    }
    return Temporal.Duration.compare(lhs.whole, rhs.whole) !== 0
  }
  return false;
}