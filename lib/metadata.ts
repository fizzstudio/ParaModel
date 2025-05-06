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
import { DataPoint } from './series';

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