/* ParaModel: Chart Data Model
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

import { Memoize } from 'typescript-memoize';
import { AllSeriesData, ChartType, Dataset, Datatype, DisplayType, Facet, Manifest, Theme } from "@fizz/paramanifest";
import { OrderOfMagnitude, ScaledNumberRounded } from '@fizz/number-scaling-rounding';

import { arrayEqualsBy, AxisOrientation, enumerate } from "../utils";
import { FacetSignature } from "../dataframe/dataframe";
import { Box, BoxSet } from "../dataframe/box";
import { AllSeriesStatsScaledValues, calculateFacetStats, FacetStats, generateValues, SeriesScaledValues } from "../metadata/metadata";
import { isXYFacetSignature, Series, seriesFromSeriesManifest, XYSeries } from './series';
import { Intersection, SeriesPairMetadataAnalyzer, TrackingGroup, TrackingZone } from '../metadata/pair_analyzer_interface';
import { BasicSeriesPairMetadataAnalyzer } from '../metadata/basic_pair_analyzer';
import { DataPoint } from './datapoint';

// Like a dictionary for series
// TODO: In theory, facets should be a set, not an array. Maybe they should be sorted first?
export class Model {
  [i: number]: Series;
  public readonly type: ChartType;
  public readonly theme: Theme;

  public readonly facetSignatures: FacetSignature[];
  public readonly facetKeys: string[] = [];
  public readonly xy: boolean;
  public readonly dependentFacetKeys: string[] = [];
  public readonly independentFacetKeys: string[] = [];  

  public readonly seriesKeys: string[] = [];
  public readonly multi: boolean;
  public readonly numSeries: number;
  public readonly seriesScaledValues?: SeriesScaledValues;
  public readonly seriesStatsScaledValues?: AllSeriesStatsScaledValues;
  public readonly intersectionScaledValues?: ScaledNumberRounded[];
  public readonly intersections: Intersection[] = [];
  public readonly clusters: string[][] = [];
  public readonly clusterOutliers: string[] = [];
  public readonly trackingGroups: TrackingGroup[] = [];
  public readonly trackingZones: TrackingZone[] = [];
  public readonly facetMap: Record<string, Facet> = {}; // FIXME: this shouldn't be exposed
  
  public readonly allPoints: DataPoint[] = [];

  protected _dataset: Dataset;

  protected _facetMappedByKey: Record<string, Facet> = {};
  protected _facetDatatypeMappedByKey: Record<string, Datatype> = {};
  protected _facetDisplayTypeMappedByKey: Record<string, DisplayType> = {};
  protected _uniqueValuesForFacetMappedByKey: Record<string, BoxSet<Datatype>> = {};
  protected _axisFacetKeys: string[] = [];
  protected _horizontalAxisFacetKey: string | null = null;
  protected _verticalAxisFacetKey: string | null = null;

  protected _seriesPairAnalyzer: SeriesPairMetadataAnalyzer | null = null;
  protected _seriesMappedByKey: Record<string, Series> = {};

  /*public readonly xs: ScalarMap[X][];
  public readonly ys: number[];*/

  constructor(public readonly series: Series[], manifest: Manifest) {
    if (this.series.length === 0) {
      throw new Error('models must have at least one series');
    }
    this.multi = this.series.length > 1;
    this._dataset = manifest.datasets[0];
    this.type = this._dataset.type;
    if (this._dataset.chartTheme) {
      this.theme = this._dataset.chartTheme;
    } else if (!this.multi) {
      this.theme = this._dataset.series[0].theme;
    } else {
      throw new Error('multi-series charts must have an overall theme');
    }

    // Facets
    this.facetSignatures = this.series[0].facetSignatures;
    this.xy = isXYFacetSignature(this.facetSignatures);
    this.facetSignatures.forEach((facet) => {
      this.facetKeys.push(facet.key);
      this._uniqueValuesForFacetMappedByKey[facet.key] = new BoxSet<Datatype>;
      this._facetDatatypeMappedByKey[facet.key] = facet.datatype;
    });
    this.facetKeys.forEach((key) => {
      const facetManifest = this._dataset.facets[key];
      this._facetDisplayTypeMappedByKey[key] = facetManifest.displayType;
      this._facetMappedByKey[key] = facetManifest;
      if (facetManifest.variableType === 'dependent') {
        this.dependentFacetKeys.push(key);
      }
      if (facetManifest.variableType === 'independent') {
        this.independentFacetKeys.push(key);
      }
      if (facetManifest.displayType.type === 'axis') {
        this._axisFacetKeys.push(key);
        if (facetManifest.displayType!.orientation === 'horizontal') {
          if (this._horizontalAxisFacetKey === null) {
            this._horizontalAxisFacetKey = key;
          } else {
            throw new Error('only one horizontal axis per chart');
          }
        } else {
          if (this._verticalAxisFacetKey === null) {
            this._verticalAxisFacetKey = key;
          } else {
            throw new Error('only one vertical axis per chart');
          }
        }
      }
    });
    if (this._axisFacetKeys.length !== 0 && this._axisFacetKeys.length !== 2) {
      throw new Error('charts must either have 2 or 0 axes')
    }
    if (this._horizontalAxisFacetKey === null || this._verticalAxisFacetKey === null) {
      this.setDefaultAxes();
    }

    // Series
    this.numSeries = this.series.length;
    for (const [aSeries, seriesIndex] of enumerate(this.series)) {
      if (this.seriesKeys.includes(aSeries.key)) {
        throw new Error('every series in a model must have a unique key');
      }
      if (!arrayEqualsBy(
        (l, r) => (l.key === r.key) && (l.datatype === r.datatype), 
        aSeries.facetSignatures, this.facetSignatures
      )) {
        throw new Error('every series in a model must have the same facets');
      }
      this.seriesKeys.push(aSeries.key);
      this[seriesIndex] = aSeries;
      this._seriesMappedByKey[aSeries.key] = aSeries;
      this.allPoints.push(...aSeries);
      Object.keys(this._uniqueValuesForFacetMappedByKey).forEach((facetKey) => {
        this._uniqueValuesForFacetMappedByKey[facetKey].merge(aSeries.allFacetValuesByKey(facetKey)!);
      });
    }

    if (this.xy) {
      if (this.multi) {
        const seriesArray = (this.series as XYSeries[]).map((series) => series.getNumericalLine());
        this._seriesPairAnalyzer = new BasicSeriesPairMetadataAnalyzer(seriesArray, [1,1]);
        this.intersections = this._seriesPairAnalyzer.getIntersections();
        this.clusters = this._seriesPairAnalyzer.getClusters();
        this.clusterOutliers = this._seriesPairAnalyzer.getClusterOutliers();
        this.trackingGroups = this._seriesPairAnalyzer.getTrackingGroups();
        this.trackingZones = this._seriesPairAnalyzer.getTrackingZones();
      }
      [this.seriesScaledValues, this.seriesStatsScaledValues, this.intersectionScaledValues] 
        = generateValues(this.series as XYSeries[], this.intersections, this.getAxisFacet('vert')?.multiplier as OrderOfMagnitude | undefined);
    }

    /*this.xs = mergeUniqueBy(
      (lhs, rhs) => xDatatype === 'date'
        ? calendarEquals(lhs as CalendarPeriod, rhs as CalendarPeriod)
        : lhs === rhs,
      ...this.series.map((series) => series.xs));
    this.ys = mergeUnique(...this.series.map((series) => series.ys));
    this.boxedXs = mergeUniqueBy(
      (lhs: Box<X>, rhs: Box<X>) => lhs.raw === rhs.raw,
      ...this.series.map((series) => series.boxedXs)
    );
    this.boxedYs = mergeUniqueBy(
      (lhs: Box<'number'>, rhs: Box<'number'>) => lhs.raw === rhs.raw,
      ...this.series.map((series) => series.boxedYs)
    );*/

  }

  // Note that this method will do nothing if the default circumstances aren't met
  private setDefaultAxes(): void {
    const independentAxes = this._axisFacetKeys.filter(
      (key) => this._dataset.facets[key].variableType === 'independent'
    );
    const dependentAxes = this._axisFacetKeys.filter(
      (key) => this._dataset.facets[key].variableType === 'dependent'
    );
    if (
      independentAxes.length === 1 && 
      dependentAxes.length === 1 &&
      (this._horizontalAxisFacetKey === null || this._horizontalAxisFacetKey === independentAxes[0]) &&
      (this._verticalAxisFacetKey === null || this._verticalAxisFacetKey === dependentAxes[0]) 
    ) {
      // NOTE: One (but not both) of these might be rewriting the axis facet key to the same thing
      this._horizontalAxisFacetKey = independentAxes[0];
      this._verticalAxisFacetKey = dependentAxes[0];
    } else if (
      this.facetKeys.includes('x') 
      && this.facetKeys.includes('y')
      && this._facetDisplayTypeMappedByKey['x']?.type === 'axis'
      && this._facetDisplayTypeMappedByKey['y']?.type === 'axis'
      && (this._horizontalAxisFacetKey === null || this._horizontalAxisFacetKey === 'x')
      && (this._verticalAxisFacetKey === null || this._verticalAxisFacetKey === 'y') ) {
        // NOTE: One (but not both) of these might be rewriting the axis facet key to the same thing
        this._horizontalAxisFacetKey === 'x';
        this._verticalAxisFacetKey === 'y';
    }
  }

  @Memoize()
  public atKey(key: string): Series | null {
    return this._seriesMappedByKey[key] ?? null;
  }
  
  public atKeyAndIndex(key: string, index: number): DataPoint | null {
    return this.atKey(key)?.[index] ?? null;
  }

  @Memoize()
  public allFacetValues(key: string): Box<Datatype>[] | null {
    return this._uniqueValuesForFacetMappedByKey[key]?.values ?? null;
  }

  @Memoize()
  public getFacetStats(key: string): FacetStats | null {
    const facetDatatype = this._facetDatatypeMappedByKey[key];
    // Checks for both non-existent and non-numerical facets
    if (facetDatatype !== 'number') {
      return null;
    }
    return calculateFacetStats(key, this.allPoints);
  }

  @Memoize()
  public getAxisFacet(orientation: AxisOrientation): Facet | null {
    if (orientation === 'horiz') {
      return this._horizontalAxisFacetKey ? this._facetMappedByKey[this._horizontalAxisFacetKey] : null;
    }
    return this._verticalAxisFacetKey ? this._facetMappedByKey[this._verticalAxisFacetKey] : null;
  }

  @Memoize()
  public getFacet(key: string): Facet | null {
    return this._facetMappedByKey[key] ?? null;
  }
}

export function facetsFromDataset(dataset: Dataset): FacetSignature[] {
  return Object.keys(dataset.facets).map((key) => ({ key, datatype: dataset.facets[key].datatype }))
}

export function modelFromInlineData(manifest: Manifest): Model {
  const dataset = manifest.datasets[0];
  if (dataset.data.source !== 'inline') {
    throw new Error('only manifests with inline data can use this method.');
  }
  const facets = facetsFromDataset(dataset);
  const series = dataset.series.map((seriesManifest) => 
    seriesFromSeriesManifest(seriesManifest, facets)
  );
  return new Model(series, manifest);
}

export function modelFromExternalData(data: AllSeriesData, manifest: Manifest): Model {
  const facets = facetsFromDataset(manifest.datasets[0]);
  const series = Object.keys(data).map((key) => {
    const seriesManifest = manifest.datasets[0].series.filter((s) => s.key === key)[0];
    return new Series(seriesManifest, data[key], facets);
  });
  return new Model(series, manifest);
}
