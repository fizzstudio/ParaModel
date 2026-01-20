/* ParaModel: Utility Functions
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

import { zip } from "@fizz/chart-classifier-utils";
import { Temporal } from "temporal-polyfill";

// Types

export type AxisOrientation = 'horiz' | 'vert';

// Errors

export class ParaModelError extends Error {
  constructor(msg: string) {
    super(`[ParaModel]: ${msg}`);
  }
}

// Container Handling

export function enumerate<T>(iterable: Iterable<T>): [T, number][] {
  const enumerations: [T, number][] = [];
  let index = 0;
  for (const member of iterable) {
    enumerations.push([member, index]);
    index++;
  }
  return enumerations;
}

export function arrayEqualsBy<L, R>(by: (lhs: L, rhs: R) => boolean, lhs: L[], rhs: R[]): boolean {
  if (lhs.length !== rhs.length) {
    return false;
  }
  for (const [l, r] of zip(lhs, rhs)) {
    if (!by(l, r)) {
      return false;
    }
  }
  return true;
}

export function addArrays(arr1: any, arr2: any) {
  if (arr1.length !== arr2.length) {
    return arr1;
  }
  const arr = [];
  for (let i = 0; i < arr1.length; i++) {
    arr.push(arr1[i] + arr2[i]);
  }
  return arr;
}

// Date Handling

export function utcTimestampToPlainDateTime(utcTimestamp: number): Temporal.PlainDateTime {
  const utcInstant = Temporal.Instant.fromEpochMilliseconds(utcTimestamp);
  const utcDateTime = utcInstant.toZonedDateTimeISO('UTC');
  return utcDateTime.toPlainDateTime();
}

// Data Grouping

export class GenericRangeBuilder<P> {
  points: P[];

  constructor(startPoint: P) {
    this.points = [startPoint];
  }

  add(point: P): void {
    this.points.push(point);
  }
}

export function groupAdjacent<P>(
  points: P[], 
  isStepBetween: (back: P, forward: P) => boolean
): (P | GenericRangeBuilder<P>)[] {
  //Quick exit for no points or single point
  if (points.length <= 1) {
    return points;
  }

  const pointsAndGroups: (P | GenericRangeBuilder<P>)[] = [];
  //First point
  if (isStepBetween(points[0], points[1])) {
    pointsAndGroups.push(new GenericRangeBuilder(points[0]));
  } else {
    pointsAndGroups.push(points[0]);
  }
  //Middle points (if any)
  for (let i = 1; i < (points.length - 1); i++) {
    if (isStepBetween(points[i - 1], points[i])) {
      const latest = pointsAndGroups.at(-1) as GenericRangeBuilder<P>;
      latest.add(points[i]);
    } else if (isStepBetween(points[i], points[i +  1])) {
      pointsAndGroups.push(new GenericRangeBuilder<P>(points[i]));
    } else {
      pointsAndGroups.push(points[i]);
    }
  }
  //Last point
  if (isStepBetween(points.at(-2)!, points.at(-1)!)) {
    const latest = pointsAndGroups.at(-1) as GenericRangeBuilder<P>;
    latest.add(points.at(-1)!);
  } else {
    pointsAndGroups.push(points.at(-1)!);
  }

  return pointsAndGroups;
}