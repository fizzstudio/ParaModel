/* ParaModel: Datapoint Data Model
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

import { Memoize } from "typescript-memoize";
import { Datatype } from "@fizz/paramanifest";
import { Point } from "@fizz/chart-classifier-utils";

import { DataFrameRow } from "../dataframe/dataframe";
import { Box, ScalarMap } from "../dataframe/box";
import { calendarNumber } from "../calendar_period";

export class DataPoint {
  constructor(protected data: DataFrameRow, public seriesKey: string, public datapointIndex: number) { }

  public entries(): Iterable<[string, Box<Datatype>]> {
    return Object.entries(this.data)[Symbol.iterator]();
  }

  public facetBox(key: string): Box<Datatype> | null {
    return this.data[key] ?? null;
  }

  public facetValue(key: string): ScalarMap[Datatype] | null {
    return this.data[key].value ?? null;
  }

  @Memoize()
  public facetAsNumber(key: string): number | null {
    const box = this.data[key];
    if (box === undefined) {
      return null;
    }
    if (box.isNumber()) {
      return box.value;
    } 
    if (box.isDate()) {
      return calendarNumber(box.value);
    } 
    return this.datapointIndex;
  }
}

export class XYDatapoint extends DataPoint {
  constructor(data: DataFrameRow, seriesKey: string, datapointIndex: number) {
    super(data, seriesKey, datapointIndex);
    if (!('x' in data) || !('y' in data)) {
      throw new Error('`XYDatapointDF` must contain `x` and `y` facets')
    }
  }

  get x(): Box<Datatype> {
    return this.data.x;
  }

  get y(): Box<Datatype> {
    return this.data.y;
  }

  @Memoize()
  getNumericalXY(): Point {
    return { x: this.facetAsNumber('x')!, y: this.facetAsNumber('y')! };
  }
}

export type DataPointConstructor 
  = new (data: DataFrameRow, seriesKey: string, datapointIndex: number) => DataPoint;