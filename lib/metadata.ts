/* ParaCharts: Chart Metadata
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

export interface ChartFacetStats {
  min: number;
  max: number;
  range: number;
  mean: number;
  median: number;
  mode: number;
}

export function calculateWholeChartFacetStats(facetValues: number[]): ChartFacetStats {
  const min = Math.min(...facetValues);
  const max = Math.max(...facetValues);

  return {
    min,
    max,
    range: max - min,
    mean: ss.mean(facetValues),
    median: ss.median(facetValues),
    mode: ss.mode(facetValues)
  };
}