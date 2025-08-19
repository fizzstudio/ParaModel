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

  // TODO: Transfer to ParaLoader
  // Note that this method will do nothing if the default circumstances aren't met
  /*private setDefaultAxes(): void {
    const independentAxes = this._axisFacetKeys.filter(
      (key) => this.dataset.facets[key].variableType === 'independent'
    );
    const dependentAxes = this._axisFacetKeys.filter(
      (key) => this.dataset.facets[key].variableType === 'dependent'
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
      this._facetKeys.includes('x') 
      && this._facetKeys.includes('y')
      && this._displayTypeForFacet['x']?.type === 'axis'
      && this._displayTypeForFacet['y']?.type === 'axis'
      && (this._horizontalAxisFacetKey === null || this._horizontalAxisFacetKey === 'x')
      && (this._verticalAxisFacetKey === null || this._verticalAxisFacetKey === 'y') ) {
        // NOTE: One (but not both) of these might be rewriting the axis facet key to the same thing
        this._horizontalAxisFacetKey === 'x';
        this._verticalAxisFacetKey === 'y';
    }
  }*/

import { Memoize } from 'typescript-memoize';
import { AllSeriesData, CHART_FAMILY_MAP, ChartType, ChartTypeFamily, Dataset, Datatype, DisplayType, Facet, Manifest, Theme } from "@fizz/paramanifest";
import type { SeriesAnalysis, SeriesAnalyzer } from "@fizz/series-analyzer";

import { arrayEqualsBy, AxisOrientation, enumerate } from "../utils";
import { FacetSignature } from "../dataframe/dataframe";
import { Box, BoxSet } from "../dataframe/box";
import { AllSeriesStatsScaledValues, calculateFacetStats, FacetStats, generateValues, SeriesScaledValues } from "../metadata/metadata";
import { Datapoint } from '../model/datapoint';
import { PlaneSeries, planeSeriesFromSeriesManifest, Series, seriesFromSeriesManifest } from './series';
import { Intersection, SeriesPairMetadataAnalyzer, TrackingGroup, TrackingZone } from '../metadata/pair_analyzer_interface';
import { BasicSeriesPairMetadataAnalyzer } from '../metadata/basic_pair_analyzer';
import { OrderOfMagnitude, ScaledNumberRounded } from '@fizz/number-scaling-rounding';
import { Interval, Line } from '@fizz/chart-classifier-utils';
import { synthesizeChartTheme, synthesizeSeriesTheme } from '../theme_synthesis';

// TODO: Remove these
export type SeriesAnalyzerConstructor = new () => SeriesAnalyzer;
export type PairAnalyzerConstructor = new (seriesArray: Line[], screenCoordSysSize: [number, number], yMin?: number, yMax?: number) => SeriesPairMetadataAnalyzer;

// Like a dictionary for series
// TODO: In theory, facets should be a set, not an array. Maybe they should be sorted first?
export class Model {
  [i: number]: Series;

  public readonly title?: string;
  public readonly description?: string;
  public readonly type: ChartType;
  public readonly family: ChartTypeFamily;

  public readonly facetSignatures: FacetSignature[];
  public readonly facetKeys: string[] = [];
  public readonly dependentFacetKeys: string[] = [];
  public readonly independentFacetKeys: string[] = [];

  public readonly seriesKeys: string[] = [];
  public readonly multi: boolean;
  public readonly numSeries: number;

  public readonly allPoints: Datapoint[] = [];

  protected _dataset: Dataset;
  protected _theme?: Theme;

  protected _facetMap: Record<string, Facet> = {};
  protected _facetDatatypeMap: Record<string, Datatype> = {};
  protected _facetDisplayTypeMap: Record<string, DisplayType> = {};
  protected _uniqueValuesForFacet: Record<string, BoxSet<Datatype>> = {};
  protected _axisFacetKeys: string[] = [];

  protected _seriesMap: Record<string, Series> = {};
  protected _seriesThemeMap: Record<string, Theme | undefined> = {};

  constructor(public readonly series: Series[], manifest: Manifest) {
    if (this.series.length === 0) {
      throw new Error('models must have at least one series');
    }

    // Whole Chart
    this.multi = this.series.length > 1;
    this._dataset = manifest.datasets[0];
    this.title = this._dataset.title;
    this.description = this._dataset.description; // May be undefined
    this.type = this._dataset.type;
    this.family = CHART_FAMILY_MAP[this.type];
    this._theme = this._dataset.chartTheme; // May be undefined 

    // Facets
    this.facetSignatures = this.series[0].facetSignatures;
    this.facetSignatures.forEach((facet) => {
      this.facetKeys.push(facet.key);
      this._uniqueValuesForFacet[facet.key] = new BoxSet<Datatype>;
      this._facetDatatypeMap[facet.key] = facet.datatype;
    });
    this.facetKeys.forEach((key) => {
      const facetManifest = this._dataset.facets[key];
      this._facetDisplayTypeMap[key] = facetManifest.displayType;
      this._facetMap[key] = facetManifest;
      if (facetManifest.variableType === 'dependent') {
        this.dependentFacetKeys.push(key);
      }
      if (facetManifest.variableType === 'independent') {
        this.independentFacetKeys.push(key);
      }
    });
    /*if (this._axisFacetKeys.length !== 0 && this._axisFacetKeys.length !== 2) {
      throw new Error('charts must either have 2 or 0 axes');
    }*/

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
      this._seriesMap[aSeries.key] = aSeries;
      this.allPoints.push(...aSeries);
      Object.keys(this._uniqueValuesForFacet).forEach((facetKey) => {
        this._uniqueValuesForFacet[facetKey].merge(aSeries.allFacetValues(facetKey)!);
      });
      this._seriesThemeMap[aSeries.key] = aSeries.manifest.theme; // May be undefined
    }
  }

  @Memoize()
  public atKey(key: string): Series | null {
    return this._seriesMap[key] ?? null;
  }
  
  public atKeyAndIndex(key: string, index: number): Datapoint | null {
    return this.atKey(key)?.[index] ?? null;
  }

  @Memoize()
  public allFacetValues(key: string): Box<Datatype>[] | null {
    return this._uniqueValuesForFacet[key]?.values ?? null;
  }

  @Memoize()
  public getFacetStats(key: string): FacetStats | null {
    const facetDatatype = this._facetDatatypeMap[key];
    // Checks for both non-existent and non-numerical facets
    if (facetDatatype !== 'number') {
      return null;
    }
    return calculateFacetStats(key, this.allPoints);
  }

  @Memoize()
  public getFacetInterval(key: string): Interval | null {
    const facetStats = this.getFacetStats(key);
    if (!facetStats) {
      return null;
    }
    return { start: facetStats.min.value, end: facetStats.max.value };
  }

  @Memoize()
  public getFacet(key: string): Facet | null {
    return this._facetMap[key] ?? null;
  }

  @Memoize()
  public hasExplictChartTheme(): boolean {
    return this._theme !== undefined;
  }

  @Memoize()
  public getChartTheme(): Theme {
    return this._theme ?? synthesizeChartTheme(this);
  }

  @Memoize()
  public getSeriesTheme(key: string): Theme | null {
    if (this.atKey(key) === null) {
      return null;
    }
    return this._seriesThemeMap[key] ?? synthesizeSeriesTheme(key, this);
  }

  public isPlaneModel(): this is PlaneModel {
    return false;
  }
}

export class PlaneModel extends Model {
  declare series: PlaneSeries[];
  [i: number]: PlaneSeries;

  public readonly grouped: boolean;

  public horizontalAxisKey?: string;
  public verticalAxisKey?: string;
  public dependentAxisKey?: string;
  public independentAxisKey?: string;

  public readonly seriesScaledValues?: SeriesScaledValues;
  public readonly seriesStatsScaledValues?: AllSeriesStatsScaledValues;
  public readonly intersectionScaledValues?: ScaledNumberRounded[];
  public readonly intersections: Intersection[] = [];
  public readonly clusters: string[][] = [];
  public readonly clusterOutliers: string[] = [];
  public readonly trackingGroups: TrackingGroup[] = [];
  public readonly trackingZones: TrackingZone[] = [];
 
  protected _seriesAnalysisMap?: Record<string, SeriesAnalysis>;
  protected _seriesPairAnalyzer: SeriesPairMetadataAnalyzer | null = null;
  protected _seriesLineMap: Record<string, Line> = {};
  protected _seriesAnalysisDone = false;

  /*public readonly xs: ScalarMap[X][];
  public readonly ys: number[];*/

  constructor(
    series: PlaneSeries[], 
    manifest: Manifest,
    private readonly seriesAnalyzerConstructor?: SeriesAnalyzerConstructor,
    private readonly pairAnalyzerConstructor: PairAnalyzerConstructor = BasicSeriesPairMetadataAnalyzer,
    protected _useWorker = true
  ) {
    super(series, manifest);

    this.grouped = this._dataset.seriesRelations === 'grouped'; // Defaults to 'stacked'

    this.facetKeys.forEach((key) => {
      const facetManifest = this._dataset.facets[key];
      if (facetManifest.displayType.type === 'axis') {
        if (facetManifest.displayType.orientation === 'horizontal') {
          this.horizontalAxisKey = key;
        } else if (facetManifest.displayType.orientation === 'vertical') {
          this.verticalAxisKey = key;
        }
      }
    });
    this.dependentAxisKey = this.dependentFacetKeys[0]; // FIXME: Assumes only 1 dependent facet
    this.independentAxisKey = this.independentFacetKeys[0]; // FIXME: Assumes only 1 dependent facet
    // FIXME: Temporary until manifests have guaranteed axis keys
    if (this.horizontalAxisKey === undefined || this.verticalAxisKey === undefined) {
      this.horizontalAxisKey = this.independentAxisKey;
      this.verticalAxisKey = this.dependentAxisKey;
    }
    if (this.type !== 'scatter') {
      for (const series of (this.series as PlaneSeries[])) {
        this._seriesLineMap[series.key] = series.getActualLine();
      }
      if (this.multi) {
        const yAxisInterval = this.getAxisInterval(this.getAxisOrientation('dependent'))!;
        this._seriesPairAnalyzer = new this.pairAnalyzerConstructor(
          Object.values(this._seriesLineMap), 
          [1,1], //FIXME: get actual screen size
          yAxisInterval.start,
          yAxisInterval.end
        );
        this.intersections = this._seriesPairAnalyzer.getIntersections();
        this.clusters = this._seriesPairAnalyzer.getClusters();
        this.clusterOutliers = this._seriesPairAnalyzer.getClusterOutliers();
        this.trackingGroups = this._seriesPairAnalyzer.getTrackingGroups();
        this.trackingZones = this._seriesPairAnalyzer.getTrackingZones();
      }
      // NOTE: `generateValues` must come after `pairAnalyzer` as `generateValues` uses the intersections defined by `pairAnalyzer`
      [this.seriesScaledValues, this.seriesStatsScaledValues, this.intersectionScaledValues] 
        = generateValues(this.series, this.intersections, this.getAxisFacet('vert')?.multiplier as OrderOfMagnitude | undefined);
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

  private async generateSeriesAnalyses(): Promise<void> {
    if (this._seriesAnalysisDone) {
      return;
    }
    const seriesAnalyzer = new this.seriesAnalyzerConstructor!();
    this._seriesAnalysisMap = {};
    for (const seriesKey in this._seriesLineMap) {
      this._seriesAnalysisMap[seriesKey] = await seriesAnalyzer.analyzeSeries(
        this._seriesLineMap[seriesKey], { 
          useWorker: this._useWorker,
          yAxis: this.getAxisInterval(this.getAxisOrientation('dependent'))!
        }
      );
    }
    this._seriesAnalysisDone = true;
  }

  @Memoize()
  public getAxisFacet(orientation: AxisOrientation): Facet | null {
    if (orientation === 'horiz') {
      return this.horizontalAxisKey ? this._facetMap[this.horizontalAxisKey] : null;
    }
    return this.verticalAxisKey ? this._facetMap[this.verticalAxisKey] : null;
  }

  @Memoize()
  public getAxisOrientation(depIndep: 'dependent'| 'independent'): AxisOrientation {
    const facetKey = depIndep === 'dependent' ? this.dependentAxisKey : this.independentAxisKey;
    if (facetKey === this.verticalAxisKey) {
      return 'vert';
    }
    return 'horiz';
  }

  @Memoize()
  public getAxisInterval(orientation: AxisOrientation): Interval | null {
    const facetKey = orientation === 'horiz' ? this.horizontalAxisKey! : this.verticalAxisKey!;
    const naturalInterval = this.getFacetInterval(facetKey);
    if (!naturalInterval) {
      return null;
    }
    let { start, end } = naturalInterval;
    const settingsMin = this._dataset.settings?.axis?.[facetKey as 'x' | 'y']?.minValue ?? 'unset';
    const settingsMax = this._dataset.settings?.axis?.[facetKey as 'x' | 'y']?.maxValue ?? 'unset';
    if (settingsMin !== 'unset') {
      start = settingsMin;
    }
    if (settingsMax !== 'unset') {
      end = settingsMax;
    }
    return { start, end };
  }

  @Memoize()
  public async getSeriesAnalysis(key: string): Promise<SeriesAnalysis | null> {
    if (
      this.type === 'scatter' 
      || !this.seriesAnalyzerConstructor
      || !this.seriesKeys.includes(key)
    ) {
      return null;
    }
    await this.generateSeriesAnalyses();
    return this._seriesAnalysisMap![key];
  }

  public isPlaneModel(): this is PlaneModel {
    return true;
  }

  public getChordAt(facetKey: string, value: Box<Datatype>): Datapoint[] | null {
    const datatype = this._facetDatatypeMap[facetKey];
    if (datatype === undefined || value.datatype() !== datatype) {
      return null;
    }
    return this.series.map((series) => series.datapointAt(facetKey, value))
      .filter((datapoint) => datapoint !== null);
  }
}

export function facetsFromDataset(dataset: Dataset): FacetSignature[] {
  return Object.keys(dataset.facets).map((key) => ({ key, datatype: dataset.facets[key].datatype }))
}

function axesFromDataset(dataset: Dataset): { independentAxisKey?: string, dependentAxisKey?: string } {
  const independentAxisKey = Object.entries(dataset.facets)
    .filter(([_facetKey, facet]) => facet.displayType.type === 'axis')
    .filter(([_facetKey, facet]) => facet.variableType === 'independent')
    .map(([facetKey, _facet]) => facetKey).at(0);
  const dependentAxisKey = Object.entries(dataset.facets)
    .filter(([_facetKey, facet]) => facet.displayType.type === 'axis')
    .filter(([_facetKey, facet]) => facet.variableType === 'dependent')
    .map(([facetKey, _facet]) => facetKey).at(0);
  return { independentAxisKey, dependentAxisKey };
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

export function planeModelFromInlineData(
  manifest: Manifest,
  seriesAnalyzerConstructor?: SeriesAnalyzerConstructor,
  pairAnalyzerConstructor?: PairAnalyzerConstructor,
  useWorker?: boolean
): PlaneModel {
  const dataset = manifest.datasets[0];
  if (dataset.data.source !== 'inline') {
    throw new Error('only manifests with inline data can use this function.');
  }
  const { independentAxisKey, dependentAxisKey } = axesFromDataset(dataset);
  if (!independentAxisKey || !dependentAxisKey) {
    throw new Error('only manifests with 2D axes can use this function.');
  }
  const facets = facetsFromDataset(dataset);
  const series = dataset.series.map((seriesManifest) => 
    planeSeriesFromSeriesManifest(seriesManifest, facets, independentAxisKey, dependentAxisKey)
  );
  return new PlaneModel(series, manifest, seriesAnalyzerConstructor, pairAnalyzerConstructor, useWorker);
}

export function planeModelFromExternalData(
  data: AllSeriesData, 
  manifest: Manifest,
  seriesAnalyzerConstructor?: SeriesAnalyzerConstructor,
  pairAnalyzerConstructor?: PairAnalyzerConstructor,
  useWorker?: boolean
): PlaneModel {
  const dataset = manifest.datasets[0];
  const { independentAxisKey, dependentAxisKey } = axesFromDataset(dataset);
  if (!independentAxisKey || !dependentAxisKey) {
    throw new Error('only manifests with 2D axes can use this function.');
  }
  const facets = facetsFromDataset(dataset);
  const series = Object.keys(data).map((key) => {
    const seriesManifest = dataset.series.filter((s) => s.key === key)[0];
    return new PlaneSeries(seriesManifest, data[key], facets, independentAxisKey, dependentAxisKey);
  });
  return new PlaneModel(series, manifest, seriesAnalyzerConstructor, pairAnalyzerConstructor, useWorker);
}