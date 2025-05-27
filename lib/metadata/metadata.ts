/* ParaModel: Chart Metadata
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
import { DataPoint, XYSeries } from '../model/series';
import { OrderOfMagnitudeNum, scaleAndRound, ScaledNumberRounded } from '@fizz/number-scaling-rounding';
import { Intersection } from './pair_analyzer_interface';

// Facet Stats

export interface DatapointsAtValue {
  value: number;
  datapoints: DataPoint[];
}

export interface FacetStats {
  min: DatapointsAtValue;
  max: DatapointsAtValue;
  range: number;
  mean: number;
  median: number;
  mode: number;
}

export function calculateFacetStats(facetKey: string, datapoints: DataPoint[]): FacetStats {
  const facetValues = datapoints.map((point) => point.facetValue(facetKey) as number);
  const minValue = Math.min(...facetValues);
  const maxValue = Math.max(...facetValues);
  const pointsAtMin = datapoints.filter((point) => (point.facetValue(facetKey) as number) === minValue);
  const pointsAtMax = datapoints.filter((point) => (point.facetValue(facetKey) as number) === maxValue);

  return {
    min: { value: minValue, datapoints: pointsAtMin },
    max: { value: maxValue, datapoints: pointsAtMax },
    range: maxValue - minValue,
    mean: ss.mean(facetValues),
    median: ss.median(facetValues),
    mode: ss.mode(facetValues)
  };
}

// Scaled & Rounded Numbers

function scaleValues(yMultiplier: OrderOfMagnitudeNum, vals: number[]): ScaledNumberRounded[] {
  const scaledInputs = vals.map((val) => ({ number: val, scale: yMultiplier }));
  return scaleAndRound(scaledInputs)
}

export type SeriesScaledValues = Record<string, ScaledNumberRounded[]>;

type SeriesStatsScaledValues = {
  start: ScaledNumberRounded;
  end: ScaledNumberRounded;
  max: ScaledNumberRounded;
  min: ScaledNumberRounded;
}

export type AllSeriesStatsScaledValues = Record<string, SeriesStatsScaledValues>;

export type GeneratedValues = [
  SeriesScaledValues,
  AllSeriesStatsScaledValues,
  ScaledNumberRounded[]
]

export function generateValues(
  allSeries: XYSeries[], 
  intersections: Intersection[], 
  yMultiplier?: OrderOfMagnitudeNum
): GeneratedValues {
  const rawSeriesValues: number[] = [];
  const rawStatsValues = [];

  for (const series of allSeries) {
    rawSeriesValues.push(...series.
      datapoints.map((point) => point.facetValue('y') as number));
    const seriesYStats = series.getFacetStats('y')!;
    rawStatsValues.push(
      series.datapoints[0].facetValue('y') as number,
      series.datapoints.at(-1)!.facetValue('y') as number,
      seriesYStats.max.value,
      seriesYStats.min.value
    )
  }

  const rawValues = rawSeriesValues.concat(rawStatsValues);

  rawValues.push(...intersections.map((intersection) => intersection.value))

  const scaled = scaleValues(yMultiplier ?? 1, rawValues);

  let stride = allSeries[0].length;

  const seriesMap: { [key: string]: ScaledNumberRounded[] } = {};

  for (let seriesIdx = 0; seriesIdx < allSeries.length; seriesIdx++) {
    const series = allSeries[seriesIdx];
    seriesMap[series.key] = scaled.slice(seriesIdx * stride, seriesIdx + 1 * stride);
  }

  let offset = allSeries.length * stride;
  stride = 4;
  
  const seriesStatsMap: { [key: string]: SeriesStatsScaledValues } = {};

  for (let seriesIdx = 0; seriesIdx < allSeries.length; seriesIdx++) {
    const series = allSeries[seriesIdx];
    seriesStatsMap[series.key] = {
      start: scaled[seriesIdx * stride + offset],
      end: scaled[seriesIdx * stride + offset + 1],
      max: scaled[seriesIdx * stride + offset + 2],
      min: scaled[seriesIdx * stride + offset + 3]
    }
  }

  offset += allSeries.length * 4;

  const intersectionValues = scaled.slice(offset);

  return [seriesMap, seriesStatsMap, intersectionValues];
}