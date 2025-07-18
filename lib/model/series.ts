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
import { Datatype, SeriesManifest, Theme } from "@fizz/paramanifest";

import { strToId } from "../utils";
import { DataFrame, DataFrameColumn, DataFrameRow, FacetSignature, RawDataPoint } from "../dataframe/dataframe";
import { Box, BoxSet, numberLikeDatatype } from "../dataframe/box";
import { calculateFacetStats, FacetStats } from "../metadata/metadata";
import { Memoize } from "typescript-memoize";
import { Line } from "@fizz/chart-classifier-utils";
import { Datapoint, PlaneDatapoint } from '../model/datapoint';

export class Series {
  [i: number]: Datapoint;
  public readonly length: number;
  public readonly id: string;
  public readonly label: string;
  public readonly theme?: Theme;
  public readonly datapoints: Datapoint[] = [];

  private readonly dataframe: DataFrame;
  private readonly uniqueValuesForFacet: Record<string, BoxSet<Datatype>> = {};
  protected datatypeMap: Record<string, Datatype> = {};

  /*protected xMap: Map<ScalarMap[X], number[]>;
  private yMap: Map<number, ScalarMap[X][]>;*/

  constructor(
    public readonly key: string, 
    public readonly rawData: RawDataPoint[], 
    public readonly facets: FacetSignature[],
    label?: string,
    theme?: Theme
  ) {
    this.dataframe = new DataFrame(facets);
    this.facets.forEach((facet) => {
      this.uniqueValuesForFacet[facet.key] = new BoxSet<Datatype>;
      this.datatypeMap[facet.key] = facet.datatype;
    });
    this.rawData.forEach((datapoint) => this.dataframe.addDatapoint(datapoint));
    this.dataframe.rows.forEach((row, index) => {
      const datapoint = this.constructDatapoint(row, this.key, index);
      this[index] = datapoint;
      this.datapoints.push(datapoint);
      Object.keys(row).forEach(
        (facetKey) => this.uniqueValuesForFacet[facetKey].add(row[facetKey])
      );
    });
    /*this.xMap = mapDatapointsXtoY(this.datapoints);
    this.yMap = mapDatapointsYtoX(this.datapoints);*/
    this.length = this.rawData.length;
    this.id = strToId(this.key); // TODO: see if we need to make this more unique
    this.label = label ?? this.key;
    if (theme) {
      this.theme = theme;
    }
  }

  protected constructDatapoint(data: DataFrameRow, seriesKey: string, datapointIndex: number): Datapoint {
    return new Datapoint(data, seriesKey, datapointIndex);
  }

  public facet(key: string): DataFrameColumn<Datatype> | null {
    return this.dataframe.facet(key);
  }

  public allFacetValues(key: string): Box<Datatype>[] | null {
    return this.uniqueValuesForFacet[key]?.values ?? null;
  }

  public getFacetDatatype(key: string): Datatype | null {
    return this.datatypeMap[key] ?? null;
  }

  /*atX(x: ScalarMap[X]): number[] | null {
    return this.xMap.get(x) ?? null;
  }

  atY(y: number): ScalarMap[X][] | null {
    return this.yMap.get(y) ?? null;
  }*/

  [Symbol.iterator](): Iterator<Datapoint> {
    return this.datapoints[Symbol.iterator]();
  }

  @Memoize()
  public getFacetStats(key: string): FacetStats | null {
    const facetDatatype = this.datatypeMap[key];
    // Checks for both non-existent and non-numerical facets
    if (!numberLikeDatatype(facetDatatype)) {
      return null;
    }
    return calculateFacetStats(key, this.datapoints);
  }

  @Memoize()
  public facetAverage(key: string): number | null {
    const facetDatatype = this.datatypeMap[key];
    // Checks for both non-existent and non-numerical facets
    if (!numberLikeDatatype(facetDatatype)) {
      return null;
    }
    return ss.mean(this.datapoints.map((point) => point.facetValueAsNumber(key)!));
  }

  @Memoize()
  public getLabel(): string {
    if (this.label) {
      return this.label;
    }
    return this.key;
  }
}

export class XYSeries extends Series {
  declare datapoints: PlaneDatapoint[];

  constructor(
    key: string, 
    rawData: RawDataPoint[], 
    facets: FacetSignature[],
    label?: string,
    theme?: Theme
  ) {
    super(key, rawData, facets, label, theme);
  }

  @Memoize()
  public getNumericalLine(): Line {
    const points = this.datapoints.map((point) => point.convertToActualXYForLine());
    return new Line(points, this.key);
  }

  protected constructDatapoint(data: DataFrameRow, seriesKey: string, datapointIndex: number): Datapoint {
    return new PlaneDatapoint(data, seriesKey, datapointIndex, 'x', 'y');
  }
}

export function isXYFacetSignature(facets: FacetSignature[]): boolean {
  const hasX = facets.some((facet) => facet.key === 'x');
  const hasY = facets.some((facet) => facet.key === 'y');
  return hasX && hasY;
}

export function seriesFromSeriesManifest(
  seriesManifest: SeriesManifest, facets: FacetSignature[]
): Series {
  if (!seriesManifest.records) {
    throw new Error('only series manifests with inline data can use this method.');
  }
  if (isXYFacetSignature(facets)) {
    return new XYSeries(
      seriesManifest.key, 
      seriesManifest.records!, 
      facets,
      seriesManifest.label,
      seriesManifest.theme
    );
  }
  return new Series(
    seriesManifest.key, 
    seriesManifest.records!, 
    facets,
    seriesManifest.label,
    seriesManifest.theme
  )
}