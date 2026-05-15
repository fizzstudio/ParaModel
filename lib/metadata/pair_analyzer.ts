/* ParaModel: Series Pair Analysis
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

import { Line, PointInterval } from '@fizz/chart-classifier-utils';

import { SpatialClusters } from './clusters';
import { Err, Errors, IntersectionProperties, LineIntersectionDetection, SegPairProperties, SegRelationship } from './line_intersection_detection';
import { Overlap, SeriesPairMetadataAnalyzer, Intersection, Parallel, Pair, TrackingGroup,
  TrackingZone, Angle, Transverse } from './pair_analyzer_interface';
import { TrackingGroupBuilder, TrackingZoneBuilder } from './tracking';

interface AngleDetails {
  top: string | null,
  angle: number,
  slope: {
    [k: string]: number
  }
}

interface AngleMap {
  [k1: string]: {
    [k2: string]: AngleDetails
  }
}

type ParallelEnd = 'converge' | 'diverge';

type TransverseKind = 'cross' | 'touch' | 'edge';

export class SeriesPairAnalyzer implements SeriesPairMetadataAnalyzer {
  intersections: Intersection[];
  overlaps: Overlap[];
  parallels: Parallel[];
  pairs: Pair[];
  trackingGroups: TrackingGroup[];
  convergingGroups: TrackingGroup[];
  divergingGroups: TrackingGroup[];
  trackingZones: TrackingZone[];
  clusters: string[][];
  clusterOutliers: string[];
  yScale: number;

  constructor(seriesArray: Line[], screenCoordSysSize: [number, number], yMin?: number, yMax?: number) {
    const screenScale = screenCoordSysSize[0] / screenCoordSysSize[1];
    const nLabel = seriesArray[0].length - 1;
    yMin = yMin ?? 0;
    yMax = yMax ?? Math.max(...seriesArray.map((series) => series.yBounds().end));
    const yTickScale = nLabel / (yMax - yMin);
    this.yScale = yTickScale * screenScale;

    this.intersections = [];
    this.overlaps = [];
    this.parallels = [];
    this.pairs = [];
    this.trackingGroups = [];
    this.convergingGroups = [];
    this.divergingGroups = [];
    this.trackingZones = [];
    this.clusters = [];
    this.clusterOutliers = [];

    const nSeries = seriesArray.length;

    for (let seriesAIndex = 0; seriesAIndex < nSeries - 1; seriesAIndex++) {
      const seriesA = seriesArray[seriesAIndex];
      if (seriesA.key === undefined) {
        throw new Err(Errors.seriesWithoutKey);
      }
      for (let seriesBIndex = seriesAIndex + 1; seriesBIndex < nSeries; seriesBIndex++) {
        const seriesB = seriesArray[seriesBIndex];
        if (seriesB.key === undefined) {
          throw new Err(Errors.seriesWithoutKey);
        }
        const series = [seriesA.key, seriesB.key] as [string, string];
        const interactions = new LineIntersectionDetection(seriesA, seriesB, this.yScale);
        const intersectionsDetails = interactions.intersectingSegPairs;

        for (let i = 0; i < intersectionsDetails.length; i++) {
          const intersectionDetails = intersectionsDetails[i];

          if (intersectionDetails.relationship === SegRelationship.Overlap) {
            continue;
          }

          const isect = intersectionDetails.intersection as IntersectionProperties;
          let record;
          const angle = this.generateAngleDetails(intersectionDetails, series, 'start');
          let inAngle;
          let outAngle;
          let transversality: Transverse;

          if (isect.atRecord) {
            if (i < intersectionsDetails.length - 1 && intersectionsDetails[i + 1].relationship === SegRelationship.Overlap) {
              continue;
            }
            if (i > 0 && intersectionsDetails[i - 1].relationship === SegRelationship.Overlap) {
              continue;
            }

            record = {
              index: isect.crosspoint.index,
              beforeIndex: null,
              afterIndex: null
            };
            if (isect.crosspoint.x === seriesA.points[0].x) {
              inAngle = null;
              outAngle = angle;
              transversality = this.getTransversal(intersectionDetails.segs, series, 'start');
            } else if (isect.crosspoint.x === seriesA.points.at(-1)!.x) {
              inAngle = angle;
              outAngle = null;
              transversality = this.getTransversal(intersectionDetails.segs, series, 'end');
            } else {
              i++;
              const nextIntersectionDetails = intersectionsDetails[i];
              inAngle = angle;
              outAngle = {
                top: this.getTop(nextIntersectionDetails.segs, series, 'end'),
                angle: (nextIntersectionDetails.intersection as IntersectionProperties).angle,
                slope: {
                  [seriesA.key]: nextIntersectionDetails.slopes.a,
                  [seriesB.key]: nextIntersectionDetails.slopes.b
                }
              };
              transversality = this.getTransversalOnRecord(intersectionDetails.segs, nextIntersectionDetails.segs, series);
            }
          } else {
            record = {
              index: null,
              beforeIndex: intersectionDetails.segs[0].start.index,
              afterIndex: intersectionDetails.segs[0].end.index
            };
            inAngle = angle;
            outAngle = angle;
            outAngle.top = this.getTop(intersectionDetails.segs, series, 'end');
            transversality = this.getTransversal(intersectionDetails.segs, series, 'middle');
          }

          const crosspoint = (intersectionDetails.intersection as IntersectionProperties).crosspoint;
          this.intersections.push({
            record,
            dependentValue: crosspoint.y,
            independentValue: crosspoint.x,
            series,
            incomingAngle: this.generateAngleMetadata(inAngle, series) as Angle,
            outgoingAngle: this.generateAngleMetadata(outAngle, series) as Angle,
            transversality
          });
        }

        let currentOverlap = this.blankOverlap(series);
        let liveOverlap = false;

        for (let i = 0; i < intersectionsDetails.length; i++) {
          const intersectionDetails = intersectionsDetails[i];

          if (intersectionDetails.relationship === SegRelationship.Overlap) {
            const start = intersectionDetails.segs[0].start;
            const end = intersectionDetails.segs[0].end;

            if (!liveOverlap) {
              currentOverlap.incomingAngle = (i === 0) ? null
                : this.generateAngleMetadata(this.generateAngleDetails(
                  intersectionsDetails[i - 1], series, 'start'
                ), series) as Angle;
              currentOverlap.datapoints.push([start.x.toString(), start.y]);
              currentOverlap.datapoints.push([end.x.toString(), end.y]);
              liveOverlap = true;
            } else {
              currentOverlap.datapoints.push([end.x.toString(), end.y]);
            }
          } else {
            if (liveOverlap) {
              currentOverlap.outgoingAngle = this.generateAngleMetadata(
                this.generateAngleDetails(intersectionsDetails[i], series, 'end'), series
              ) as Angle;
              this.overlaps.push(structuredClone(currentOverlap));
              currentOverlap = this.blankOverlap(series);
              liveOverlap = false;
            }
          }
        }

        if (liveOverlap) {
          this.overlaps.push(currentOverlap);
        }

        const allProps = interactions.allSegPairProps;
        let currentParallel = this.blankParallel(series);
        let liveParallel = false;
        let nParallelSegs = 0;

        for (let i = 0; i < allProps.length; i++) {
          const props = allProps[i];

          if (props.relationship === SegRelationship.Parallel
              || props.relationship === SegRelationship.FunctionallyParallel) {
            const start = props.segs[0].start;
            const end = props.segs[0].end;
            nParallelSegs++;

            if (props.relationship === SegRelationship.FunctionallyParallel) {
              currentParallel.kind = 'functional';
            }

            if (!liveParallel) {
              currentParallel.incomingDirection = (i === 0) ? null
                : this.determineDirection(allProps[i - 1], 'start');
              currentParallel.records.push({ label: start.x.toString() });
              currentParallel.records.push({ label: end.x.toString() });
              liveParallel = true;
            } else {
              currentParallel.records.push({ label: end.x.toString() });
            }
          } else {
            if (liveParallel) {
              currentParallel.outgoingDirection = (i === allProps.length - 1) ? null
                : this.determineDirection(allProps[i + 1], 'end');
              this.parallels.push(structuredClone(currentParallel));
              currentParallel = this.blankParallel(series);
              liveParallel = false;
            }
          }
        }

        if (liveParallel) {
          this.parallels.push(currentParallel);
        }

        this.pairs.push({
          series,
          dominant: (interactions.dominant === -1) ? null : series[interactions.dominant - 1],
          dominantPercent: interactions.timeOnTop,
          parallelPercent: (nParallelSegs / allProps.length) * 100
        });
      }
    }

    const { trackingGroups, convergingGroups, divergingGroups } = TrackingGroupBuilder.getGroups(seriesArray, undefined, 0.90);
    this.trackingGroups = trackingGroups.map((tg) => this.generateTrackingGroupMetadata(tg, 'tracking'));
    this.convergingGroups = convergingGroups.map((tg) => this.generateTrackingGroupMetadata(tg, 'converging'));
    this.divergingGroups = divergingGroups.map((tg) => this.generateTrackingGroupMetadata(tg, 'diverging'));
    if (trackingGroups.length) {
      this.trackingZones = TrackingZoneBuilder.getZones(trackingGroups)
        .map((tz) => this.generateTrackingZoneMetadata(tz));
    }
    const clusters = new SpatialClusters(seriesArray);
    this.clusters = clusters.clusters.map((cluster) => cluster.map((line) => line.key!));
    this.clusterOutliers = clusters.noise.map((line) => line.key!);
  }

  getIntersections(): Intersection[] {
    return this.intersections;
  }

  getOverlaps(): Overlap[] {
    return this.overlaps;
  }

  getParallels(): Parallel[] {
    return this.parallels;
  }

  getPairs(): Pair[] {
    return this.pairs;
  }

  getTrackingGroups(): TrackingGroup[] {
    return this.trackingGroups;
  }

  getConvergingGroups(): TrackingGroup[] {
    return this.convergingGroups;
  }

  getDivergingGroups(): TrackingGroup[] {
    return this.divergingGroups;
  }

  getTrackingZones(): TrackingZone[] {
    return this.trackingZones;
  }

  getClusters(): string[][] {
    return this.clusters;
  }

  getClusterOutliers(): string[] {
    return this.clusterOutliers;
  }

  private generateTrackingGroupMetadata(
    trackingGroup: TrackingGroupBuilder,
    type: 'tracking' | 'converging' | 'diverging'
  ): TrackingGroup {
    return {
      keys: Array.from(trackingGroup.keys),
      outliers: trackingGroup.outliers(),
      valueInterval: trackingGroup.interval,
      averageLine: trackingGroup.averageLine().points.map((point) => [point.x, point.y]),
      differentialLines: trackingGroup.computeDifferentialLine(trackingGroup.keys),
      type
    };
  }

  private generateTrackingZoneMetadata(trackingZone: TrackingZoneBuilder): TrackingZone {
    return {
      groups: trackingZone.trackingGroups.map((trackingGroup) => this.generateTrackingGroupMetadata(trackingGroup, 'tracking')),
      valueInterval: [trackingZone.interval.start, trackingZone.interval.end]
    };
  }

  private generateAngleDetails(
    intersectionDetails: SegPairProperties, series: [string, string], side: 'start' | 'end'
  ): AngleDetails {
    return {
      top: this.getTop(intersectionDetails.segs, series, side),
      angle: (intersectionDetails.intersection as IntersectionProperties).angle,
      slope: {
        [series[0]]: intersectionDetails.slopes.a,
        [series[1]]: intersectionDetails.slopes.b
      }
    };
  }

  private generateAngleMetadata(
    angleDetails: AngleDetails | null, series: [string, string]
  ): AngleMap | null {
    if (angleDetails === null) {
      return null;
    }
    return {
      [series[0]] : {
        [series[1]] : angleDetails
      },
      [series[1]] : {
        [series[0]] : angleDetails
      }
    };
  }

  private blankOverlap(series: [string, string]): Overlap {
    return {
      datapoints: [],
      series,
      incomingAngle: null,
      outgoingAngle: null,
    };
  }

  private blankParallel(series: [string, string]): Parallel {
    return {
      records: [],
      series,
      incomingDirection: null,
      outgoingDirection: null,
      kind: 'perfect'
    };
  }

  private getTop(segs: [PointInterval, PointInterval], seriesName: [string, string], side: 'start' | 'end'): string | null {
    const topIndex = this.getTopIndex(segs, side);
    if (topIndex === null) {
      return null;
    }
    return seriesName[topIndex];
  }

  private getTopIndex(segs: [PointInterval, PointInterval], side: 'start' | 'end'): number | null {
    const yValueA = segs[0][side].y;
    const yValueB = segs[1][side].y;
    if (yValueA > yValueB) {
      return 0;
    } else if (yValueA < yValueB) {
      return 1;
    } else {
      return null;
    }
  }

  private determineDirection(props: SegPairProperties, side: 'start' | 'end'): ParallelEnd {
    const startDist = Math.abs(props.segs[0].start.y - props.segs[1].start.y);
    const endDist = Math.abs(props.segs[0].end.y - props.segs[1].end.y);
    const closeDist = (side === 'start') ? endDist : startDist;
    const farDist = (side === 'start') ? startDist : endDist;
    if (closeDist < farDist) {
      return 'converge';
    }
    return 'diverge';
  }

  private getTransversal(
    segs: [PointInterval, PointInterval],
    seriesNames: [string, string],
    edge: 'start' | 'end' | 'middle'
  ): Transverse {
    let kind: TransverseKind;
    let topIdx;
    if (edge !== 'middle') {
      kind = 'edge';
      const testEdge = (edge === 'start' ? 'end' : 'start');
      topIdx = this.getTopIndex(segs, testEdge) as number;
    } else {
      topIdx = this.getTopIndex(segs, 'start') as number;
      const endTopIdx = this.getTopIndex(segs, 'end') as number;
      if (topIdx === endTopIdx) {
        kind = 'touch';
      } else {
        kind = 'cross';
      }
    }
    const bottomIdx = +(topIdx === 0);
    if (kind === 'cross') {
      return {
        kind,
        topToBottom: seriesNames[topIdx],
        bottomToTop: seriesNames[bottomIdx]
      };
    }
    return {
      kind,
      top: seriesNames[topIdx],
      bottom: seriesNames[bottomIdx]
    };
  }

  private getTransversalOnRecord(
    leftSegs: [PointInterval, PointInterval],
    rightSegs: [PointInterval, PointInterval],
    seriesNames: [string, string],
  ): Transverse {
    const leftTopIndex = this.getTopIndex(leftSegs, 'start') as number;
    const rightTopIndex = this.getTopIndex(rightSegs, 'end') as number;
    if (leftTopIndex === rightTopIndex) {
      const bottomIdx = +(leftTopIndex === 0);
      return {
        kind: 'touch',
        top: seriesNames[leftTopIndex],
        bottom: seriesNames[bottomIdx]
      };
    } else {
      return {
        kind: 'cross',
        topToBottom: seriesNames[leftTopIndex],
        bottomToTop: seriesNames[rightTopIndex],
      };
    }
  }
}