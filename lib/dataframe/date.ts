/* ParaModel: Date Values
Copyright (C) 2026 Fizz Studios

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.*/

// Imports

import { Temporal, Intl } from "temporal-polyfill";

// Types

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

// TEMP

// @simonvarey: This is a temp fix until ParaLoader outputs standard datetime strings
const QUARTER_START_MONTHS = ['01', '04', '07', '10'];

// @simonvarey: This is a temp fix until ParaLoader outputs standard datetime strings
type DurationName = 'year' | 'quarter' | 'day';
const DURATIONS: Record<DurationName, string> = {
  year: '1Y',
  quarter: '3M',
  day: '1D'
}

// @simonvarey: This is a temp fix until ParaLoader outputs standard datetime strings
export function parseDateToStandardFormat(input: string): string | null {
  let yearNumber = parseFloat(input);
  let monthstr = '01';
  let dayStr = '01';
  const duration: DurationName = input[0] === 'Q' ? 'quarter' : (
    input[0] === 'D' ? 'day' : 'year'
  );
  if (duration === 'quarter') {
    const quarterNumber = parseInt(input[1]) - 1;
    if (input[3] === "'") {
      yearNumber = parseInt(input.substring(4)) + 2000;
    } else {
      yearNumber = parseInt(input.substring(3));
    }
    if (Number.isNaN(yearNumber) || Number.isNaN(quarterNumber)) {
      return null;
    }
    monthstr = QUARTER_START_MONTHS[quarterNumber];
  }
  if (duration === 'day') {
    yearNumber = parseInt(input.slice(1, 5));
    monthstr = input.slice(5, 7);
    dayStr = input.slice(7, 9);
  }
  const iso8601 = `P${DURATIONS[duration]}`;
  return `${yearNumber}${monthstr}${dayStr}${iso8601}`
}

const EPOCH = Temporal.PlainDateTime.from('19700101');

// Parsing

// TODO: Add support for Recurring Periods
export function convertStandardFormatToDateValue(rfc9557iso8601: string): DateValue {
  const [rfc9557, iso8601] = rfc9557iso8601.split('P');
  return {
    type: 'date',
    start: Temporal.PlainDateTime.from(rfc9557),
    duration: Temporal.Duration.from('P' + iso8601)
  };
}

// Comparison

export function compareDateValues(lhs: DateValue, rhs: DateValue): boolean {
  if (lhs.type === 'date' && rhs.type === 'date') {
    if (Temporal.PlainDateTime.compare(lhs.start, rhs.start) !== 0) {
      return false;
    }
    return Temporal.Duration.compare(lhs.duration, rhs.duration, { relativeTo: EPOCH }) === 0;
  }
  if (lhs.type === 'recurring' && rhs.type === 'recurring') {
    if (Temporal.PlainDateTime.compare(lhs.start, rhs.start) !== 0) {
      return false;
    }
    if (Temporal.Duration.compare(lhs.part, rhs.part, { relativeTo: EPOCH }) !== 0) {
      return false;
    }
    return Temporal.Duration.compare(lhs.whole, rhs.whole, { relativeTo: EPOCH }) === 0;
  }
  return false;
}

// Printing

const INTL_DAY = new Intl.DateTimeFormat('en-US', {year: 'numeric', month: 'numeric', day: 'numeric' });

export function formatDateValue(dateVal: DateValue): string {
  if (dateVal.type === 'date') {
    if (dateVal.duration.toString() === 'P1Y') {
      return `${dateVal.start.year}`;
    }
    if (dateVal.duration.toString() === 'P3M') {
      const quarterNumber = (dateVal.start.month - 1)/3;
      const quarterOrdinal = ['first', 'second', 'third', 'fourth'][quarterNumber];
      return `the ${quarterOrdinal} quarter of ${dateVal.start.year}`;
    }
    return INTL_DAY.format(dateVal.start);
  }
  return 'RECURRING DATES NOT IMPLEMENTED YET';
}
