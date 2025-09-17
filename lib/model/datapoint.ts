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

import { DataFrameRow, dataFrameRowEquals } from "../dataframe/dataframe";
import { Box, ScalarMap } from "../dataframe/box";

export class Datapoint {
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
  public facetValueAsNumber(key: string): number | null {
    const box = this.data[key];
    if (box === undefined || !box.isNumberLike()) {
      return null;
    }
    return box.asNumber();
  }

  @Memoize()
  public facetValueNumericized(key: string): number | null {
    const box = this.data[key];
    if (box === undefined) {
      return null;
    }
    if (box.isNumber()) {
      return box.value;
    } 
    if (box.isDate()) {
      return box.asNumber();
    } 
    return this.datapointIndex;
  }

  @Memoize()
  public convertFacetValuesToXYForLine(xKey: string, yKey: string): Point | null {
    const x = this.facetValueNumericized(xKey);
    const y = this.facetValueNumericized(yKey);
    if (x === null || y === null) {
      return null;
    }
    return { x , y };
  }

  public equals(other: Datapoint): boolean {
    return dataFrameRowEquals(this.data, other.data) 
      && this.seriesKey === other.seriesKey && this.datapointIndex === other.datapointIndex;
  }
}

export class PlaneDatapoint extends Datapoint {
  constructor(
    data: DataFrameRow, 
    seriesKey: string, 
    datapointIndex: number, 
    public indepKey: string, 
    public depKey: string
  ) {
    super(data, seriesKey, datapointIndex);
    if (!(indepKey in data)) {
      throw new Error(`'PlaneDatapoint' is missing the '${indepKey}' independent axis facet value`);
    }
    if (!(depKey in data)) {
      throw new Error(`'PlaneDatapoint' is missing the '${depKey}' dependent axis facet value`);
    }
  }

  get indepBox(): Box<Datatype> {
    return this.data[this.indepKey];
  }

  get depBox(): Box<Datatype> {
    return this.data[this.depKey];
  }

  // TODO: Is this needed any more with PlaneSeries?
  convertToActualXYForLine(): Point {
    return this.convertFacetValuesToXYForLine(this.indepKey, this.depKey)!;
  }
}

export type DatapointConstructor = new (
  data: DataFrameRow, seriesKey: string, datapointIndex: number, indepKey?: string, depKey?: string
) => Datapoint;
