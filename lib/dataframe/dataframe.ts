/* ParaModel: Dataframes
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

import { mapn } from '@fizz/chart-classifier-utils';

import { Box, BOX_CONSTRUCTORS } from './box';
import { Datatype } from '@fizz/paramanifest';

/*
import { 
  Series, type Scalar, type DataArray, type SeriesOpts,
  NumberSeries, StringSeries, DateSeries, type AnySeries,
  type ScalarArray
} from './series';


type DataArrayObj = {[key: string]: DataArray<Scalar>} | {[key: number]: DataArray<Scalar>};
type SrcData = DataArray<Scalar>[] | DataArrayObj | Series<Scalar>[];


type DatatypeObj = {[key: string]: Datatype};*/
/**
 * Data frame options.
 * @public
 */
/*export interface DataFrameOpts {
  columns?: string[];
  dtypes?: Datatype[] | DatatypeObj;
}

class ColumnIterable {

  constructor(private data: Series<Scalar>[]) {
  }

  *[Symbol.iterator]() {
    for (let i = 0; i < this.data.length; i++) {
      yield [i, this.data[i].copy()] as [number, Series<Scalar>];
    }
  }

}

const seriesTypes = {
  number: NumberSeries,
  string: StringSeries,
  object: DateSeries,
  date: DateSeries
};

function arrayToCol(ary: DataArray<Scalar>, dtype?: Datatype, opts?: SeriesOpts) {
  const ctor = seriesTypes[dtype ?? typeof ary[0] as keyof typeof seriesTypes];
  return new ctor(ary as DataArray<any>, opts);
}*/

export type RawDatapoint = Record<string, string>;

export type FacetSignature = { key: string, datatype: Datatype };

export type DataFrameColumn<T extends Datatype> = Box<T>[];
export type DataFrameRow = Record<string, Box<Datatype>>;

/**
 * Spreadsheet-like container for a series. Each column is a facet/dimension, 
 * and each row is a datapoint.
 * @public
 */
export class DataFrame {

  private columns: DataFrameColumn<Datatype>[];
  private facetKeyIndexMap: Record<string, number> = {};

  constructor(private readonly facets: FacetSignature[]) {
    if (this.facets.length === 0) {
      throw new Error('dataframes must have at least 1 column');
    }
    this.columns = mapn(this.facets.length, _i => []);
    this.facets.forEach((signature, facetIndex) => {
      this.facetKeyIndexMap[signature.key] = facetIndex;
    })
    /*if (Array.isArray(srcData)) {
      if (Array.isArray(srcData[0])) {
        this.data = srcData.map((ary, i) => 
          arrayToCol(ary as DataArray<Scalar>, (opts?.dtypes as Datatype[])?.[i], {
            name: opts?.columns?.[i] ?? `${i}`
          }));
      } else {
        this.data = srcData.map(series => 
          (series as AnySeries).copy());
      }
    } else {
      this.data = Object.entries(srcData).map(([key, value]) => 
        arrayToCol(value, (opts?.dtypes as DatatypeObj)?.[key], {name: key}));
    }*/
  }

  public addDatapoint(rawDatapoint: RawDatapoint): void {
    const datapointNumFacets = Object.keys(rawDatapoint).length;
    if (datapointNumFacets !== this.nColumns) {
      throw new Error(`datapoint ${rawDatapoint} cannot be added to dataframe. This dataframe has ${this.nColumns} columns, but this datapoint as ${datapointNumFacets} facets`);
    }
    mapn(this.nColumns, i => {
      const columnFacet = this.facets[i];
      const columnRawValue = rawDatapoint[columnFacet.key];
      if (columnRawValue === undefined) {
        throw new Error(`datapoint ${rawDatapoint} is missing the facet ${columnFacet.key}`);
      }
      this.columns[i].push(new BOX_CONSTRUCTORS[columnFacet.datatype](columnRawValue));
    });
  }

  get nRows(): number {
    return this.columns[0].length;
  }

  get nColumns(): number {
    return this.columns.length;
  }

  get rows(): DataFrameRow[] {
    return mapn(this.nRows, (rowIndex) => {
      const row: DataFrameRow = {};
      this.columns.forEach((column, columnIndex) => {
        row[this.facets[columnIndex].key] = column[rowIndex];
      });
      return row;
    })
  }

  public facet(key: string): DataFrameColumn<Datatype> | null {
    return this.columns[this.facetKeyIndexMap[key]] ?? null;
  }

  /** Iterate over the rows, producing DataFrames of one row. */
  /* *[Symbol.iterator]() {
    for (let i = 0; i < this.nRows; i++) {
      yield [i, this.slice(i, i + 1)] as [number, DataFrame];
    }
  }*/

  /** Iterate over the columns, producing Series. */
  /*get iterCols() {
    return new ColumnIterable(this.data);
  }

  private checkRowBounds(row: number) {
    if (row < 0) {
      if (row < -this.nRows) {
        throw new Error(`row index '${row}' out of bounds`);
      }
      row = this.data[0].length + row;
    } else if (row >= this.nRows) {
      throw new Error(`row index '${row}' out of bounds`);
    }
  }*/

  /**
   * Retrieve the row at the given index as a series.
   * @param row - The row.
   * @remarks
   * Will fail if all columns are not of the same type.
   */
  /*row(row: number) {
    this.checkRowBounds(row);
    if (this.data.length === 0) {
      throw new Error('data frame has no columns');
    }
    const type = this.data[0].dtype;
    this.data.slice(1).forEach(series => {
      if (series.dtype !== type) {
        throw new Error(`all columns must have type '${type}'`);
      }
    }); 
    return new seriesTypes[type](this.data.map(series => series.at(row)) as ScalarArray);
  }

  col(name: string) {
    const series = this.data.find(series => series.name === name);
    if (!series) {  
      throw new Error(`no column with name '${name}'`);
    }
    return series;
  }

  slice(start?: number, end?: number) {
    return new DataFrame(
      this.data.map(series => series.slice(start, end)));
  }

  at(row: number, col: string) {
    this.checkRowBounds(row);
    const series = this.data.find(series => series.name === col);
    if (!series) {
      throw new Error(`no column with name '${col}'`);
    }
    return series.atBoxed(row);
  }

  private assertColsExist(colNames: string[]) {
    const existingColNames = this.data.map(series => series.name!);
    colNames.forEach(name => {
      if (!existingColNames.includes(name)) {
        throw new Error(`no such column '${name}'`);
      }
    });
  }

  takeCols(colNames: string[]) {
    this.assertColsExist(colNames);
    return new DataFrame(colNames.map(name => this.col(name)!));
  }

  dropCols(colNames: string[]) {
    this.assertColsExist(colNames);
    const existingColNames = this.data.map(series => series.name!);
    return new DataFrame(
      existingColNames
        .filter(name => !colNames.includes(name))
        .map(name => this.col(name)!));
  }

  map<T>(fn: (el: DataFrame, index: number) => T): T[] {
    const out: T[] = [];
    for (const [i, row] of this) {
      out.push(fn(row, i));
    }
    return out;
  }

  mapCols<T>(fn: (el: Series<Scalar>, index: number) => T): T[] {
    const out: T[] = [];
    for (const [i, col] of this.iterCols) {
      out.push(fn(col, i));
    }
    return out;
  }*/

}