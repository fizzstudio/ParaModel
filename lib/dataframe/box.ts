/* ParaModel: Boxed Data
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

import { Temporal } from "temporal-polyfill";

import { Datatype } from "@fizz/paramanifest";

import { ParaModelError } from "../utils";

// TODO: This type lacks a completeness type check. This could be implemented by testing in Vitest
// that `keyof ScalarMap extends Datatype` and vice versa and `ScalarMap[Datatype] extends Scalar` 
// and vice versa. 
export type ScalarMap = {
  number: number,
  string: string,
  date: Temporal.PlainDateTime
}

export function numberLikeDatatype(datatype: Datatype | null): boolean {
  return datatype === 'number' || datatype === 'date';
}

/**
 * Box holding a series value and its source "raw" value.
 * @public
 */
export abstract class Box<T extends Datatype> {
  public readonly value: ScalarMap[T];
  
  constructor(public readonly raw: string) {
    this.value = this.convertRaw(raw);
  }

  abstract convertRaw(raw: string): ScalarMap[T];

  abstract isNumber(): this is {value: number};

  abstract isString(): this is {value: string};

  abstract isDate(): this is {value: Temporal.PlainDateTime};

  abstract isEqual(other: Box<T>): boolean;

  abstract isNumberLike(): boolean;

  abstract asNumber(): number | null;

  abstract datatype(): T;
}

/**
 * Box holding a number.
 * @public
 */
export class NumberBox extends Box<'number'> {

  convertRaw(raw: string): number {
    const val = parseFloat(raw);
    if (isNaN(val)) {
      throw new Error('x values in Numeric Datapoints must be numbers');
    }
    return val;
  }

  public isNumber(): this is {value: number} {
    return true;
  }

  public isString(): this is {value: string} {
    return false;
  }

  public isDate(): this is {value: Temporal.PlainDateTime} {
    return false;
  }

  public isEqual(other: Box<'number'>) {
    return this.value === other.value;
  }

  public isNumberLike(): boolean {
    return true;
  }

  public asNumber(): number {
    return this.value;
  }

  public datatype(): 'number' {
    return 'number';
  }
}

/**
 * Box holding a string.
 * @public
 */
export class StringBox extends Box<'string'> {

  convertRaw(raw: string): string {
    return raw;
  }
  
  public isNumber(): this is {value: number} {
    return false;
  }

  public isString(): this is {value: string} {
    return true;
  }

  public isDate(): this is {value: Temporal.PlainDateTime} {
    return false;
  }

  public isEqual(other: Box<'string'>) {
    return this.value === other.value;
  }

  public isNumberLike(): boolean {
    return false;
  }

  public asNumber(): null {
    return null;
  }

  public datatype(): 'string' {
    return 'string';
  }
}

// @simonvarey: This is a temp fix until ParaLoader outputs RFC9557 datetime strings
const QUARTER_START_MONTHS = ['01', '04', '07', '10']

// @simonvarey: This is a temp fix until ParaLoader outputs RFC9557 datetime strings
function parseDateToRFC9557(input: string): string | null {
  let yearNumber = parseFloat(input);
  let quarterNumber = 0;
  if (input[0] === 'Q') {
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
  return `${yearNumber}${QUARTER_START_MONTHS[quarterNumber]}01`
}

/**
 * Box holding a date.
 * @public
 */
export class DateBox extends Box<'date'> {

  convertRaw(raw: string): Temporal.PlainDateTime {
    const rfc9557 = parseDateToRFC9557(raw);
    if (rfc9557 === null) {
      throw new ParaModelError(`Raw date string "${raw}" could not be parsed.`);
    }
    try {
      const date = Temporal.PlainDateTime.from(rfc9557);
      return date;
    } catch (err) {
      throw new ParaModelError(`RFC9557 date string "${rfc9557}" could not be parsed. Parsing error: ${err}`);
    }
  }
  
  public isNumber(): this is {value: number} {
    return false;
  }

  public isString(): this is {value: string} {
    return false;
  }

  public isDate(): this is {value: Temporal.PlainDateTime} {
    return true;
  }

  public isEqual(other: Box<'date'>): boolean {
    return Temporal.PlainDateTime.compare(this.value, other.value) === 0;
  }

  public isNumberLike(): boolean {
    return true;
  }

  // Temporal requires PlaneDateTimes be converted to ZonedDateTimes to get their milliseconds since
  //   the epoch (1/1/1970). We convert PlaneDateTimes to an arbitrary time zone here (UTC, i.e. 
  //   Greenwich mean time) as we are only concerned with the relative differences between PlaneDateTimes
  public asNumber(): number {
    return this.value.toZonedDateTime('UTC').epochMilliseconds
  }

  public datatype(): 'date' {
    return 'date';
  }
}

type BoxConstructor<T extends Datatype> = new (raw: string) => Box<T>;

type BoxConstructorMap = { [T in Datatype]: BoxConstructor<T> };

export const BOX_CONSTRUCTORS: BoxConstructorMap = {
  string: StringBox,
  number: NumberBox,
  date: DateBox
}

export class BoxSet<T extends Datatype> {
  private boxes: Box<T>[] = [];

  get values(): Box<T>[] {
    return this.boxes;
  }

  public has(box: Box<T>): boolean {
    return this.boxes.some((otherBox) => box.isEqual(otherBox));
  }

  public add(box: Box<T>): void {
    if (!this.has(box)) {
      this.boxes.push(box);
    }
  }

  public merge(boxes: Box<T>[]): void {
    boxes.forEach((box) => this.add(box));
  }
}