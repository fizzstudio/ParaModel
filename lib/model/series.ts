/* ParaModel: Series Data Model
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
import * as ss from 'simple-statistics';
import { Datatype, SeriesManifest, Theme } from "@fizz/paramanifest";
import { Line, Point } from "@fizz/chart-classifier-utils";

import { strToId } from "../utils";
import { DataFrame, DataFrameColumn, DataFrameRow, FacetSignature, RawDataPoint } from "../dataframe/dataframe";
import { Box, BoxSet, ScalarMap } from "../dataframe/box";
import { calculateFacetStats, FacetStats } from "../metadata/metadata";
import { calendarNumber } from "../calendar_period";
import { SingleSeriesMetadataAnalyzer } from "../metadata/series_analyzer_interface";
import { BasicSingleSeriesAnalyzer } from "../metadata/basic_series_analyzer";

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

type DataPointConstructor = new (data: DataFrameRow, seriesKey: string, datapointIndex: number) => DataPoint;

export class Series {
  [i: number]: DataPoint;

  public readonly key: string;
  public readonly id: string;
  public readonly label: string;
  public readonly theme: Theme;  

  public readonly length: number;
  public readonly datapoints: DataPoint[] = [];

  protected readonly _dataframe: DataFrame;
  protected readonly _datapointConstructor: DataPointConstructor;

  protected readonly _uniqueValuesForFacetMappedByKey: Record<string, BoxSet<Datatype>> = {};
  protected readonly _facetDatatypeMappedByKey: Record<string, Datatype> = {};

  /*protected xMap: Map<ScalarMap[X], number[]>;
  private yMap: Map<number, ScalarMap[X][]>;*/

  constructor(
    public readonly manifest: SeriesManifest,
    public readonly rawData: RawDataPoint[], 
    public readonly facetSignatures: FacetSignature[],
  ) {
    this.key = this.manifest.key;
    this.id = strToId(this.key); // TODO: see if we need to make this more unique
    this.label = this.manifest.label ?? this.key;
    this.theme = this.manifest.theme;

    this.facetSignatures.forEach((facet) => {
      this._uniqueValuesForFacetMappedByKey[facet.key] = new BoxSet<Datatype>;
      this._facetDatatypeMappedByKey[facet.key] = facet.datatype;
    });

    this._datapointConstructor = this._getDatapointConstructor();
    this._dataframe = new DataFrame(facetSignatures);
    this.length = this.rawData.length;    
    this.rawData.forEach((datapoint) => this._dataframe.addDatapoint(datapoint));
    this._dataframe.rows.forEach((row, index) => {
      const datapoint = new this._datapointConstructor(row, this.key, index);
      this[index] = datapoint;
      this.datapoints.push(datapoint);
      Object.keys(row).forEach(
        (facetKey) => this._uniqueValuesForFacetMappedByKey[facetKey].add(row[facetKey])
      );
    });

    /*this.xMap = mapDatapointsXtoY(this.datapoints);
    this.yMap = mapDatapointsYtoX(this.datapoints);*/
  }

  protected _getDatapointConstructor(): DataPointConstructor {
    return DataPoint;
  }

  @Memoize()
  public facetBoxesByKey(key: string): DataFrameColumn<Datatype> | null {
    return this._dataframe.facet(key);
  }

  @Memoize()
  public allFacetValuesByKey(key: string): Box<Datatype>[] | null {
    return this._uniqueValuesForFacetMappedByKey[key]?.values ?? null;
  }

  @Memoize()
  public getFacetDatatypeByKey(key: string): Datatype | null {
    return this._facetDatatypeMappedByKey[key] ?? null;
  }

  /*atX(x: ScalarMap[X]): number[] | null {
    return this.xMap.get(x) ?? null;
  }

  atY(y: number): ScalarMap[X][] | null {
    return this.yMap.get(y) ?? null;
  }*/

  [Symbol.iterator](): Iterator<DataPoint> {
    return this.datapoints[Symbol.iterator]();
  }

  @Memoize()
  public getFacetStats(key: string): FacetStats | null {
    const facetDatatype = this._facetDatatypeMappedByKey[key];
    // Checks for both non-existent and non-numerical facets
    if (facetDatatype !== 'number') {
      return null;
    }
    return calculateFacetStats(key, this.datapoints);
  }
}

export class XYSeries extends Series {
  declare datapoints: XYDatapoint[];
  
  protected _getDatapointConstructor(): DataPointConstructor {
    return XYDatapoint;
  }

  @Memoize()
  public getNumericalLine(): Line {
    const points = this.datapoints.map((point) => point.getNumericalXY());
    return new Line(points, this.key);
  }

  @Memoize()
  public getAverage(): number {
    const points = this.datapoints.map((point) => point.getNumericalXY().y);
    return ss.average(points);
  }

  @Memoize()
  public getAnalyzer(): SingleSeriesMetadataAnalyzer {
    return new BasicSingleSeriesAnalyzer(this.getNumericalLine());
  }
}

export function isXYFacetSignature(facets: FacetSignature[]): boolean {
  const hasX = facets.some((facet) => facet.key === 'x');
  const hasY = facets.some((facet) => facet.key === 'y');
  return hasX && hasY;
}

export function seriesFromSeriesManifest(
  seriesManifest: SeriesManifest, facetSignatures: FacetSignature[]
): Series {
  if (!seriesManifest.records) {
    throw new Error('only series manifests with inline data can use this method.');
  }
  const seriesConstructor = isXYFacetSignature(facetSignatures) ? XYSeries : Series;
  return new seriesConstructor(
    seriesManifest, 
    seriesManifest.records!, 
    facetSignatures
  );
}