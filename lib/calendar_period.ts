/* ParaModel: Calendar Period Datatype
Copyright (C) 2025 Fizz Studios

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

export type CalendarPeriod = {
  year?: number,
  quarter?: number,
  month?: number,
  day?: number
}

function calendarFromNumber(input: number): CalendarPeriod {
  const year = Math.trunc(input);
  const remander = input - year;
  const quarter = remander === 0 ? undefined : remander * 4;
  return { year, quarter };
}

export function parseCalendar(input: string): CalendarPeriod | null {
  const calendarNumber = parseFloat(input);
  if (Number.isNaN(calendarNumber)) {
    return null;
  }
  return calendarFromNumber(calendarNumber);
}

export function calendarEquals(lhs: CalendarPeriod, rhs: CalendarPeriod): boolean {
  return lhs.year === rhs.year && lhs.quarter === rhs.quarter;
}

export function calendarString(period: CalendarPeriod): string {
  throw new Error('not implemented');
}

export function calendarNumber(period: CalendarPeriod): number {
  return (period.year ?? 0) + ((period.quarter ?? 0) / 4);
}

export function calendarGoBack(period: CalendarPeriod, step: CalendarPeriod): CalendarPeriod {
  const periodNumber = calendarNumber(period);
  const stepNumber = calendarNumber(step);
  const resultNumber = periodNumber - stepNumber;
  return calendarFromNumber(resultNumber);
}
