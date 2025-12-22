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

import { Datatype } from "@fizz/paramanifest";

import { ParaModelError } from "../utils";
import { compareDateValues, convertStandardFormatToDateValue, DateValue, parseDateToStandardFormat } from "./date";

// TODO: This type lacks a completeness type check. This could be implemented by testing in Vitest
// that `keyof ScalarMap extends Datatype` and vice versa and `ScalarMap[Datatype] extends Scalar` 
// and vice versa. 
export type ScalarMap = {
  number: number,
  string: string,
  date: DateValue
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

  abstract isDate(): this is {value: DateValue};

  abstract isEqual(other: Box<T>): boolean;

  abstract isNumberLike(): boolean;

  abstract asNumber(): number | null;

  abstract asDate(): DateValue | null;

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

  public isDate(): this is {value: DateValue} {
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

  public asDate(): null {
    return null;
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

  public isDate(): this is {value: DateValue} {
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

  public asDate(): null {
    return null;
  }

  public datatype(): 'string' {
    return 'string';
  }
}

/**
 * Box holding a date.
 * @public
 */
export class DateBox extends Box<'date'> {

  convertRaw(raw: string): DateValue {
    const standardFormat = parseDateToStandardFormat(raw);
    if (standardFormat === null) {
      throw new ParaModelError(`Raw date string "${raw}" could not be parsed.`);
    }
    return convertStandardFormatToDateValue(standardFormat);
  }
  
  public isNumber(): this is {value: number} {
    return false;
  }

  public isString(): this is {value: string} {
    return false;
  }

  public isDate(): this is {value: DateValue} {
    return true;
  }

  public isEqual(other: Box<'date'>): boolean {
    return compareDateValues(this.value, other.value);
  }

  public isNumberLike(): boolean {
    return true;
  }

  // Temporal requires PlaneDateTimes be converted to ZonedDateTimes to get their milliseconds since
  //   the epoch (1/1/1970). We convert PlaneDateTimes to an arbitrary time zone here (UTC, i.e. 
  //   Greenwich mean time) as we are only concerned with the relative differences between PlaneDateTimes
  public asNumber(): number {
    return this.value.start.toZonedDateTime('UTC').epochMilliseconds;
  }

  public asDate(): DateValue {
    return this.value;
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