/* ParaModel: AI-enhanced Series Clustering Analysis
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

import { Line } from '@fizz/chart-classifier-utils';
import { findSplitIndex } from '@fizz/breakdancer';

import * as stat from 'simple-statistics';

const MIN_POINTS = 2;
const NOISE = -1;

/**
 * Given a set of ordered values, compute the distance 
 * between a given value and its k-th nearest neighbor.
 * @param k - Ordinal indicator of neighbor to compute distance from.
 * @param p - Value.
 * @param values - All values.
 * @returns Distance (a positive value).
 */
function kDist(k: number, p: number, values: number[]): number {
  // NB: `dists` contains 0 (since `values` contains `d`)
  const dists = values.map(v => Math.abs(p - v));
  dists.sort((a, b) => Math.sign(a - b));
  return dists[k];
}

/**
 * DBSCAN (Density-Based Clustering of Applications with Noise) implementation.
 * @param values 
 * @param distFunc 
 * @param eps - A point must have at least `minPts` neighbors (including itself) within
 * this radius to be a core point.
 * @param minPts - Min neighbors (including itself) a point must have within radius `eps`
 * to be a core point.
 * @returns Map of values to cluster tags (non-negative numbers for clusters, else NOISE)
 */
function dbscan(values: number[], distFunc: (a: number, b: number) => number, eps: number, minPts: number) {
  let c = -1;                                              // Cluster counter
  const labels: Map<number, number> = new Map(); 
  for (const p of values) {
    if (labels.get(p) !== undefined) {
      // Previously processed in inner loop  
      continue; 
    }               
    const neighbors = rangeQuery(values, distFunc, p, eps);     // Find neighbors 
    if (neighbors.length < minPts) {                          // Density check 
      labels.set(p, NOISE);                                   // Label as Noise 
      //console.log(`${p}: NOISE`);
      continue;
    }
    c++;                                                  // next cluster label 
    labels.set(p, c);                                        // Label initial point
    //console.log(`${p}: ${c}`);
    const seedSet = new Set(Array.from(neighbors).filter(e => e !== p));  // Neighbors to expand 
    //console.log(`${p} seedSet:`, seedSet);
    for (const q of seedSet) {                                  // Process every seed point q 
      if (labels.get(q) === NOISE) { 
        // Change Noise to border point 
        labels.set(q, c); 
        //console.log(`relabel ${q}: ${c}`);
      }          
      if (labels.get(q) !== undefined) { 
        // Previously processed (e.g., border point) 
        continue; 
      }           
      labels.set(q, c);                                     // Label neighbor 
      //console.log(`${q}: ${c}`);
      const neighbors = rangeQuery(values, distFunc, q, eps);          // Find neighbors 
      if (neighbors.length >= minPts) {                          // Density check (if Q is a core point) 
        for (const n of neighbors) {                      // Add new neighbors to seed set
          seedSet.add(n);
          //console.log('added to seedSet:', n);
        }
      }
    }
  }
  return labels;
}

function rangeQuery(values: number[], dist: (a: number, b: number) => number, q: number, eps: number) {
  return values.filter(n => dist(q, n) <= eps);
}

/**
 * Uses DBSCAN algorithm to find spatial clusters of series on a chart.
 * @public
 */
export class SpatialClusters {
  /** 
   * Array of series clusters.
   */
  clusters: Line[][] = [];
  /**
   * Series that don't belong to any cluster.
   */
  noise: Line[] = [];
  
  /**
   * @param allSeries - All series of a chart.
   * @param minPts - Optional min neighbors (including itself) a point must have
   * to be considered a core point.
   */
  constructor(allSeries: Line[], minPts = MIN_POINTS) {
    const means = allSeries.map(line => stat.mean(line.points.map(p => p.y)));
    //allSeries.forEach((line, i) => console.log(`${line.key} mean: ${means[i]}`));
    // Distances of each mean to its nearest neighbor (sorted in descending order)
    const kDists = means.map(mean => kDist(1, mean, means)).toSorted((a, b) => -Math.sign(a - b));
    const kDists1Line = Line.fromValues(kDists);
    const splitIdx = findSplitIndex(kDists1Line, kDists1Line.length);
    const minY = Math.min(...allSeries.map(ln => ln.yBounds().start));
    const maxY = Math.max(...allSeries.map(ln => ln.yBounds().end));
    const yRange = maxY - minY;
    // Minimum allowed core point cluster radius
    const minEps = yRange/10;
    const eps = Math.max(kDists[splitIdx], minEps);
    const clusterTags = dbscan(means, (a, b) => Math.abs(a - b), eps, minPts);
    for (let i = 0; i < means.length; i++) {
      const tag = clusterTags.get(means[i])!;
      if (tag === NOISE) {
        this.noise.push(allSeries[i]);
      } else {
        let clusterLines = this.clusters[tag];
        if (!clusterLines) {
          this.clusters[tag] = clusterLines = [];
        }
        clusterLines.push(allSeries[i]);
      }
    }

  }
}