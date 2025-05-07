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
import { AllSeriesData, Dataset, Datatype, DisplayType, Facet, Manifest, Theme } from "@fizz/paramanifest";

import { arrayEqualsBy, AxisOrientation, enumerate } from "./utils";
import { FacetSignature } from "./dataframe/dataframe";
import { Box, BoxSet } from "./dataframe/box";
import { calculateFacetStats, FacetStats } from "./metadata";
import { DataPoint, Series, seriesFromSeriesManifest } from './series';

// Like a dictionary for series
// TODO: In theory, facets should be a set, not an array. Maybe they should be sorted first?
export class Model {
  public readonly keys: string[] = [];
  [i: number]: Series;
  public readonly facets: FacetSignature[];
  public readonly multi: boolean;
  public readonly numSeries: number;
  public readonly allPoints: DataPoint[] = [];
  public readonly theme: Theme;

  protected keyMap: Record<string, Series> = {};
  protected datatypeMap: Record<string, Datatype> = {};
  private uniqueValuesForFacet: Record<string, BoxSet<Datatype>> = {};

  protected _facetKeys: string[] = [];
  protected _facetMap: Record<string, Facet> = {};
  protected _axisFacetKeys: string[] = [];
  protected _horizontalAxisFacetKey: string | null = null;
  protected _verticalAxisFacetKey: string | null = null;
  private _displayTypeForFacet: Record<string, DisplayType | undefined> = {}; // FIXME: remove `| undefined`

  private dataset: Dataset;

  /*public readonly xs: ScalarMap[X][];
  public readonly ys: number[];*/

  constructor(public readonly series: Series[], manifest: Manifest) {
    if (this.series.length === 0) {
      throw new Error('models must have at least one series');
    }
    this.dataset = manifest.datasets[0];
    this.theme = this.dataset.chartTheme!;

    // Facets
    this.facets = this.series[0].facets;
    this.facets.forEach((facet) => {
      this._facetKeys.push(facet.key);
      this.uniqueValuesForFacet[facet.key] = new BoxSet<Datatype>;
      this.datatypeMap[facet.key] = facet.datatype;
    });
    this._facetKeys.forEach((key) => {
      const facetManifest = this.dataset.facets[key];
      this._displayTypeForFacet[key] = facetManifest.displayType;
      this._facetMap[key] = facetManifest;
      if (facetManifest.displayType?.type === 'axis') { // FIXME: remove `?`
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
      //this.setDefaultAxes();
    }
    //////////////////////// TEMP //////////////////////////////////////////
    this._displayTypeForFacet['x'] = {type: 'axis', orientation: 'horizontal'};
    this._horizontalAxisFacetKey = 'x';
    this._displayTypeForFacet['y'] = {type: 'axis', orientation: 'vertical'};
    this._verticalAxisFacetKey = 'y';
    ////////////////////////////////////////////////////////////////////////

    // Series
    this.multi = this.series.length > 1;
    this.numSeries = this.series.length;
    for (const [aSeries, seriesIndex] of enumerate(this.series)) {
      if (this.keys.includes(aSeries.key)) {
        throw new Error('every series in a model must have a unique key');
      }
      if (!arrayEqualsBy(
        (l, r) => (l.key === r.key) && (l.datatype === r.datatype), 
        aSeries.facets, this.facets
      )) {
        throw new Error('every series in a model must have the same facets');
      }
      this.keys.push(aSeries.key);
      this[seriesIndex] = aSeries;
      this.keyMap[aSeries.key] = aSeries;
      this.allPoints.push(...aSeries);
      Object.keys(this.uniqueValuesForFacet).forEach((facetKey) => {
        this.uniqueValuesForFacet[facetKey].merge(aSeries.allFacetValues(facetKey)!);
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

  private setDefaultAxes(): void {
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
    } else {
      throw new Error('axis facets cannot be determined');
    }
  }

  @Memoize()
  public atKey(key: string): Series | null {
    return this.keyMap[key] ?? null;
  }
  
  public atKeyAndIndex(key: string, index: number): DataPoint | null {
    return this.atKey(key)?.[index] ?? null;
  }

  @Memoize()
  public allFacetValues(key: string): Box<Datatype>[] | null {
    return this.uniqueValuesForFacet[key]?.values ?? null;
  }

  @Memoize()
  public getFacetStats(key: string): FacetStats | null {
    const facetDatatype = this.datatypeMap[key];
    // Checks for both non-existent and non-numerical facets
    if (facetDatatype !== 'number') {
      return null;
    }
    return calculateFacetStats(key, this.allPoints);
  }

  @Memoize()
  public getAxisFacet(orientation: AxisOrientation): Facet | null {
    if (orientation === 'horiz') {
      return this._horizontalAxisFacetKey ? this._facetMap[this._horizontalAxisFacetKey] : null;
    }
    return this._verticalAxisFacetKey ? this._facetMap[this._verticalAxisFacetKey] : null;
  }

  @Memoize()
  public getFacet(key: string): Facet | null {
    return this._facetMap[key] ?? null;
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

// FIXME: This function does not include series labels (as seperate from series keys) or series themes
export function modelFromExternalData(data: AllSeriesData, manifest: Manifest): Model {
  const facets = facetsFromDataset(manifest.datasets[0]);
  const series = Object.keys(data).map((key) => 
    new Series(key, data[key], facets)
  );
  return new Model(series, manifest);
}
