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

// ID Generation

/**
 * Takes a string and normalizes it, stripping it of any non-alphanum characters and replacing its 
 *   whitespaces with underscores, so that can can serve as a DOM id.
 * @param {string} s A string, which may have spaces, punctuation, or other non-alphanum characters.
 * @returns {string} The unique string, stripped of all non-alphanum characters, to be used as an id.
 * @internal
 */
export function strToId(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '_').replace(/[^\w-]+/g, '');
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