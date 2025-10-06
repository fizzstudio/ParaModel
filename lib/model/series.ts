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

import * as ss from 'simple-statistics';
import { Datatype, SeriesManifest, strToId } from "@fizz/paramanifest";

import { DataFrame, DataFrameColumn, DataFrameRow, FacetSignature, RawDataPoint } from "../dataframe/dataframe";
import { Box, BoxSet, numberLikeDatatype } from "../dataframe/box";
import { calculateFacetStats, FacetStats } from "../metadata/metadata";
import { Memoize } from "typescript-memoize";
import { Line } from "@fizz/chart-classifier-utils";
import { Datapoint, PlaneDatapoint } from '../model/datapoint';

export class Series {
  [i: number]: Datapoint;

  public readonly key: string;
  public readonly id: string;
  public readonly label: string;

  public readonly length: number;
  public readonly datapoints: Datapoint[] = [];
  public readonly facetKeys: string[] = [];

  protected readonly _dataframe: DataFrame;

  protected readonly _uniqueValuesForFacetMappedByKey: Record<string, BoxSet<Datatype>> = {};
  protected readonly _facetDatatypeMappedByKey: Record<string, Datatype> = {};

  constructor(
    public readonly manifest: SeriesManifest,
    public readonly rawData: RawDataPoint[], 
    public readonly facetSignatures: FacetSignature[],
    protected readonly indepKey?: string,
    protected readonly depKey?: string
  ) {
    this.key = this.manifest.key;
    this.id = strToId(this.key); // TODO: see if we need to make this more unique
    this.label = this.manifest.label ?? this.key;

    this.facetSignatures.forEach((facet) => {
      this.facetKeys.push(facet.key);
      this._uniqueValuesForFacetMappedByKey[facet.key] = new BoxSet<Datatype>;
      this._facetDatatypeMappedByKey[facet.key] = facet.datatype;
    });

    this._dataframe = new DataFrame(facetSignatures);
    this.length = this.rawData.length;
    this.rawData.forEach((datapoint) => this._dataframe.addDatapoint(datapoint));
    this._dataframe.rows.forEach((row, index) => {
      const datapoint = this.constructDatapoint(row, this.key, index);
      this[index] = datapoint;
      this.datapoints.push(datapoint);
      Object.keys(row).forEach(
        (facetKey) => this._uniqueValuesForFacetMappedByKey[facetKey].add(row[facetKey])
      );
    });
  }

  protected constructDatapoint(data: DataFrameRow, seriesKey: string, datapointIndex: number): Datapoint {
    return new Datapoint(data, seriesKey, datapointIndex);
  }

  @Memoize()
  public facetBoxes(key: string): DataFrameColumn<Datatype> | null {
    return this._dataframe.facet(key);
  }

  @Memoize()
  public allFacetValues(key: string): Box<Datatype>[] | null {
    return this._uniqueValuesForFacetMappedByKey[key]?.values ?? null;
  }

  @Memoize()
  public getFacetDatatype(key: string): Datatype | null {
    return this._facetDatatypeMappedByKey[key] ?? null;
  }

  // TODO: X and Y datatypes should be number-like
  @Memoize()
  public createLineFromFacets(xKey: string, yKey: string): Line | null {
    if (!this.facetKeys.includes(xKey) || !this.facetKeys.includes(yKey)) {
      return null;
    }
    const points = this.datapoints.map((point) => point.convertFacetValuesToXYForLine(xKey, yKey)!);
    return new Line(points, this.key);
  }

  @Memoize()
  public facetAverage(key: string): number | null {
    const facetDatatype = this._facetDatatypeMappedByKey[key];
    // Checks for both non-existent and non-numerical facets
    if (!numberLikeDatatype(facetDatatype)) {
      return null;
    }
    return ss.mean(this.datapoints.map((point) => point.facetValueAsNumber(key)!));
  }

  @Memoize()
  public getFacetStats(key: string): FacetStats | null {
    const facetDatatype = this._facetDatatypeMappedByKey[key];
    // Checks for both non-existent and non-numerical facets
    if (!numberLikeDatatype(facetDatatype)) {
      return null;
    }
    return calculateFacetStats(key, this.datapoints);
  }

  [Symbol.iterator](): Iterator<Datapoint> {
    return this.datapoints[Symbol.iterator]();
  }

  // Assumes at most one datapoint at that value at that facet
  public datapointAt(facetKey: string, value: Box<Datatype>): Datapoint | null {
    const datatype = this._facetDatatypeMappedByKey[facetKey];
    if (datatype === undefined || value.datatype() !== datatype) {
      return null;
    }
    for (const datapoint of this.datapoints) {
      if (datapoint.facetBox(facetKey)!.isEqual(value)) {
        return datapoint;
      }
    }
    return null;
  }

  // Deprecated
  @Memoize()
  public getLabel(): string {
    if (this.label) {
      return this.label;
    }
    return this.key;
  }
}

export class PlaneSeries extends Series {
  /*declare*/ [i: number]: PlaneDatapoint;

  declare datapoints: PlaneDatapoint[];
  declare indepKey: string;
  declare depKey: string;
  
  /*protected xMap: Map<ScalarMap[X], number[]>;
  private yMap: Map<number, ScalarMap[X][]>;*/

  constructor(
    manifest: SeriesManifest,
    rawData: RawDataPoint[], 
    facetSignatures: FacetSignature[],
    indepKey: string,
    depKey: string
  ) {
    super(manifest, rawData, facetSignatures, indepKey, depKey);

    console.assert(this.facetKeys.includes(indepKey), `[ParaModel/Internal]: PlaneSeries constructed with unknown indepKey ${indepKey}`);
    console.assert(this.facetKeys.includes(depKey), `[ParaModel/Internal]: PlaneSeries constructed with unknown depKey ${depKey}`);
    console.assert(numberLikeDatatype(this.getFacetDatatype(depKey)), `[ParaModel/Internal]: PlaneSeries depKey ${depKey} has non-number-like ${this.getFacetDatatype(depKey)} datatype`);

    /*this.xMap = mapDatapointsXtoY(this.datapoints);
    this.yMap = mapDatapointsYtoX(this.datapoints);*/
  }
  
  protected constructDatapoint(data: DataFrameRow, seriesKey: string, datapointIndex: number): Datapoint {
    return new PlaneDatapoint(data, seriesKey, datapointIndex, this.indepKey, this.depKey);
  }

  @Memoize()
  public getActualLine(): Line {
    return this.createLineFromFacets(this.indepKey, this.depKey)!;
  }

  @Memoize()
  public getIndepAverage(): number {
    return this.facetAverage(this.indepKey)!;
  }

  // TODO: Add This
  /*@Memoize()
  public getAnalyzer(): SingleSeriesMetadataAnalyzer {
    return new BasicSingleSeriesAnalyzer(this.createActualLine());
  }*/

  /*atX(x: ScalarMap[X]): number[] | null {
    return this.xMap.get(x) ?? null;
  }

  atY(y: number): ScalarMap[X][] | null {
    return this.yMap.get(y) ?? null;
  }*/
}

export function seriesFromSeriesManifest(
  seriesManifest: SeriesManifest, facetSignatures: FacetSignature[]
): Series {
  if (!seriesManifest.records) {
    throw new Error('only series manifests with inline data can use this method.');
  }
  return new Series(seriesManifest, seriesManifest.records!, facetSignatures);
}

export function planeSeriesFromSeriesManifest(
  seriesManifest: SeriesManifest, facetSignatures: FacetSignature[], indepKey: string, depKey: string
): PlaneSeries {
  if (!seriesManifest.records) {
    throw new Error('only series manifests with inline data can use this method.');
  }
  return new PlaneSeries(
    seriesManifest, 
    seriesManifest.records!, 
    facetSignatures,
    indepKey,
    depKey
  );
}