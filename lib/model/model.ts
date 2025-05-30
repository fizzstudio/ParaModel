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
import { Series, seriesFromSeriesManifest, PlaneSeries } from './series';
import { Intersection, SeriesPairMetadataAnalyzer, TrackingGroup, TrackingZone } from '../metadata/pair_analyzer_interface';
import { BasicSeriesPairMetadataAnalyzer } from '../metadata/basic_pair_analyzer';
import { Datapoint } from './datapoint';

// Like a dictionary for series
// TODO: In theory, facets should be a set, not an array. Maybe they should be sorted first?
export class Model {
  [i: number]: Series;
  public readonly type: ChartType;
  public readonly theme: Theme;

  public readonly facetSignatures: FacetSignature[];
  public readonly facetKeys: string[] = [];
  public readonly dependentFacetKeys: string[] = [];
  public readonly independentFacetKeys: string[] = [];  

  public readonly seriesKeys: string[] = [];
  public readonly multi: boolean;
  public readonly numSeries: number;
  public horizontalAxisKey?: string;
  public verticalAxisKey?: string;
  public readonly facetMap: Record<string, Facet> = {}; // FIXME: this shouldn't be exposed
  
  public readonly allPoints: Datapoint[] = [];

  protected _dataset: Dataset;

  protected _facetMappedByKey: Record<string, Facet> = {};
  protected _facetDatatypeMappedByKey: Record<string, Datatype> = {};
  protected _facetDisplayTypeMappedByKey: Record<string, DisplayType> = {};
  protected _uniqueValuesForFacetMappedByKey: Record<string, BoxSet<Datatype>> = {};
  //protected _axisFacetKeys: string[] = [];


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
        if (facetManifest.displayType.orientation === 'horizontal') {
          this.horizontalAxisKey = key;
        } else {
          this.verticalAxisKey = key;
        }
      }
    });

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

  @Memoize()
  public atKey(key: string): Series | null {
    return this._seriesMappedByKey[key] ?? null;
  }
  
  public atKeyAndIndex(key: string, index: number): Datapoint | null {
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
      return this.horizontalAxisKey ? this._facetMappedByKey[this.horizontalAxisKey] : null;
    }
    return this.verticalAxisKey ? this._facetMappedByKey[this.verticalAxisKey] : null;
  }

  @Memoize()
  public getFacet(key: string): Facet | null {
    return this._facetMappedByKey[key] ?? null;
  }
}

export class PlaneModel extends Model {
  declare series: PlaneSeries[];
  [i: number]: PlaneSeries;

  public readonly seriesScaledValues?: SeriesScaledValues;
  public readonly seriesStatsScaledValues?: AllSeriesStatsScaledValues;
  public readonly intersectionScaledValues?: ScaledNumberRounded[];
  public readonly intersections: Intersection[] = [];
  public readonly clusters: string[][] = [];
  public readonly clusterOutliers: string[] = [];
  public readonly trackingGroups: TrackingGroup[] = [];
  public readonly trackingZones: TrackingZone[] = [];

  constructor(series: PlaneSeries[], manifest: Manifest) {
    super(series, manifest);
    


    [this.seriesScaledValues, this.seriesStatsScaledValues, this.intersectionScaledValues] 
      = generateValues(this.series, this.intersections, this.getAxisFacet('vert')?.multiplier as OrderOfMagnitude | undefined);

    if (this.multi) {
      const seriesArray = this.series.map((series) => series.createActualLine());
      this._seriesPairAnalyzer = new BasicSeriesPairMetadataAnalyzer(seriesArray, [1,1]); //FIXME: screensize, max/min 
      this.intersections = this._seriesPairAnalyzer.getIntersections();
      this.clusters = this._seriesPairAnalyzer.getClusters();
      this.clusterOutliers = this._seriesPairAnalyzer.getClusterOutliers();
      this.trackingGroups = this._seriesPairAnalyzer.getTrackingGroups();
      this.trackingZones = this._seriesPairAnalyzer.getTrackingZones();
    }
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
