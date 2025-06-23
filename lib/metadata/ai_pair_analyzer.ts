/* ParaModel: AI-enhanced Series Pair Analysis
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
import { Interval, Line } from "@fizz/chart-classifier-utils";
import { Breakdancer } from '@fizz/breakdancer';
import { classifySlope } from "@fizz/chart-message-candidates";

import { SeriesPairMetadataAnalyzer, TrackingGroup, TrackingZone } from "./pair_analyzer_interface";
import { BasicLineIntersectionDetection, BasicSeriesPairMetadataAnalyzer, IntersectionProperties } from "./basic_pair_analyzer";
import { TrackingGroupBuilder, TrackingZoneBuilder } from "./tracking";
import { SpatialClusters } from './clusters';

/**
 * Represents the relationship between two series as they traverse
 * a given x-interval.
 * @public
 */
export interface RelativeTrajectory {
  /** X-value interval */
  interval: Interval;
  /** Mutual relationship */
  type: 'tracking' | 'converging' | 'diverging';
  /** Value between 0 and 1 indicating the strength of the relationship */
  degree: number;
}

export class AiLineIntersectionDetection extends BasicLineIntersectionDetection {
  /** 
   * Absolute differences between corresponding series point values
   * NB: Contains additional 0-y-value points for any off-record crossings.
   */
  public differentialLine: Line;

  constructor(series1: Line, series2: Line, yScale: number) {
    super(series1, series2, yScale);
    this.differentialLine = this.computeDifferentialLine();
  }

  private computeDifferentialLine() {
    let diff = new Line(this.series1.points.map(
      (p, i) => ({x: p.x, y: Math.abs(p.y - this.series2.points[i].y)})));  
    const isectPairs = this.intersectingSegPairs
      .filter(p => p.intersection !== 'Overlap');
    const btwnRecIsects = isectPairs
      .filter(p => !(p.intersection as IntersectionProperties).atRecord)
      .map(p => (p.intersection as IntersectionProperties).crosspoint);
    // insert btwnRecIsects into diff   
    for (const bri of btwnRecIsects) {
      const i = diff.points.findLastIndex(p => bri.x > p.x);
      const pts = Array.from(diff.points);
      pts.splice(i + 1, 0, {x: bri.x, y: 0});
      diff = new Line(pts);
    }
    return diff;
  }

  /**
   * 
   * @param yAxis - Interval from 0 to the y-range of the chart, representing
   * the minimum and maximum possible y-value differences between records of two series.
   * @returns 
   */
  getRelativeTrajectories(yAxis: Interval) {
    const relativeTrajectories: RelativeTrajectory[] = [];
    const bd = new Breakdancer();
    const seqs = bd.getSequences(this.differentialLine, yAxis);
    // Project so that all possible series pairs for a chart get
    // slope classification performed in the same coordinate system.
    const proj = this.differentialLine.project(undefined, yAxis);
    const slopeInfo = seqs.map(
      ({start, end}) => classifySlope(proj.slice(start, end)));
    for (let i = 0; i < seqs.length; i++) {
      const si = slopeInfo[i];
      if (si.classes.length === 2) {
        if (Math.abs(si.moe!) < Math.abs(si.slope)) {
          // non-noisy rising or falling
          const zeroIdx = si.classes.indexOf(0);
          if (Math.abs(si.angle) < 5) {
            // treat as stable (tracking)
            si.classes.splice(1 - zeroIdx, 1);
          } else {
            si.classes.splice(zeroIdx, 1);
          }
        }
      }
      const interval = {
        start: this.differentialLine.points[seqs[i].start].x,
        end: this.differentialLine.points[seqs[i].end - 1].x
      };
      if (si.classes[0] === 0) {
        relativeTrajectories.push({
          interval,
          type: 'tracking',
          degree: 1 - ss.sampleStandardDeviation(
            this.differentialLine
              .slice(seqs[i].start, seqs[i].end)
              .points.map(p => p.y))/yAxis.end
        });
      } else {
        relativeTrajectories.push({
          interval, 
          type: si.classes[0] === 1 ? 'diverging' : 'converging',
          degree: Math.abs(si.angle/90)
        });
      }
    }

    const mergedRts: RelativeTrajectory[] = [];
    if (relativeTrajectories.length) {
      mergedRts.push(relativeTrajectories[0]);
      for (let i = 1; i < relativeTrajectories.length; i++) {
        if (relativeTrajectories[i].type === relativeTrajectories[i - 1].type) {
          mergedRts.at(-1)!.interval.end = relativeTrajectories[i].interval.end;
        } else {
          mergedRts.push(relativeTrajectories[i]);
        }
      }
    }  
    return mergedRts;
  }
}

export class AiSeriesPairMetadataAnalyzer extends BasicSeriesPairMetadataAnalyzer implements SeriesPairMetadataAnalyzer {

  constructor(seriesArray: Line[], screenCoordSysSize: [number, number], yMin?: number, yMax?: number) {
    super(seriesArray, screenCoordSysSize, yMin, yMax);
    const trackingGroups = TrackingGroupBuilder.getGroups(seriesArray, undefined, 0.90);
    this.trackingGroups = trackingGroups.map((tg) => this.generateTrackingGroupMetadata(tg));
    if (trackingGroups.length) {
      this.trackingZones = TrackingZoneBuilder.getZones(trackingGroups)
        .map((tz) => this.generateTrackingZoneMetadata(tz));
    }
    const clusters = new SpatialClusters(seriesArray);
    this.clusters = clusters.clusters.map((cluster) => cluster.map((line) => line.key!));
    this.clusterOutliers = clusters.noise.map((line) => line.key!);
  }

    private generateTrackingGroupMetadata(tg: TrackingGroupBuilder): TrackingGroup {
    return {
      keys: Array.from(tg.keys),
      outliers: tg.outliers(),
      interval: [`${tg.interval.start}`, `${tg.interval.end}`],
      averageLine: tg.averageLine().points.map((point) => [point.x, point.y])
    }
  }

  private generateTrackingZoneMetadata(tz: TrackingZoneBuilder): TrackingZone {
    return {
      groups: tz.trackingGroups.map((tg) => this.generateTrackingGroupMetadata(tg)),
      interval: [`${tz.interval.start}`, `${tz.interval.end}`]
    }
  }
  
}