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

import { Line, PointInterval } from "@fizz/chartsignal-internal";

import { Overlap, Intersection, Parallel, Pair, TrackingGroup, TrackingZone, Angle, 
  Transverse } from "./pair_analyzer_interface";
import { TrackingGroupBuilder, TrackingZoneBuilder } from "./tracking";
import { SpatialClusters } from './clusters';
import { Err, Errors, IntersectionProperties, LineIntersectionDetection, SegPairProperties, SegRelationship } from "./line_intersection_detection";

// Types

interface AngleIncludingOverlapDetails {
  top: string | null,
  angle: number,
  slope: {
    [k: string]: number
  }
}

interface AngleIncludingOverlap {
  [k1: string]: {
    [k2: string]: AngleIncludingOverlapDetails
  }
}

type ParallelEnd = 'converge' | 'diverge';

type TransverseKind = 'cross' | 'touch' | 'edge';

// Main

export class SeriesPairMetadataAnalyzer {
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

  //screenCoordSysSize: [xScreenSize, yScreenSize], only ratio matters
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

    // only search for intersections if there is more than a single series
    // TODO: should this be handled elsewhere/should this error on a single series?
    const nSeries = seriesArray.length;
    if (nSeries === 1) {
      return;
    }

    // Step through series A (except final series)
    for (let seriesAIndex = 0; seriesAIndex < nSeries - 1; seriesAIndex++) {
      const seriesA = seriesArray[seriesAIndex];
      if (seriesA.key === undefined) {
        throw new Err(Errors.seriesWithoutKey);
      }
      //Step through other series B
      for (let seriesBIndex = seriesAIndex + 1; seriesBIndex < nSeries; seriesBIndex++) {
        const seriesB = seriesArray[seriesBIndex];
        if (seriesB.key === undefined) {
          throw new Err(Errors.seriesWithoutKey);
        }
        const series = [seriesA.key, seriesB.key] as [string, string];

        // Get interaction details between series A and series B
        const interactions = new LineIntersectionDetection(seriesA, seriesB, this.yScale)
        
        // Get intersection details between series A and series B
        const intersectionsDetails = interactions.intersectingSegPairs;
        
        // Collect intersections (while skipping overlaps)
        for (let i = 0; i < intersectionsDetails.length; i++) {
          const intersectionDetails = intersectionsDetails[i];

          // Case: Intersection is Overlap
          if (intersectionDetails.relationship === SegRelationship.Overlap) {
            continue;
          }

          // Case: Intersection is not overlap - given it is not disjoint, it must be an intersection, so cast is allowed
          const isect = intersectionDetails.intersection as IntersectionProperties;
          let record;
          const angle = this.generateAngleDetails(intersectionDetails, series, 'start')
          let inAngle;
          let outAngle;
          let transversality: Transverse;
          
          // Subcase: Intersection is at a record
          if (isect.atRecord) {
            // Subsubcase: Intersection precedes Overlap
            if (i < intersectionsDetails.length - 1 && intersectionsDetails[i+1].relationship === SegRelationship.Overlap) {
              continue;
            }
            // Subsubcase: Intersection follows Overlap
            if (i > 0 && intersectionsDetails[i-1].relationship === SegRelationship.Overlap) {
              continue;
            }

            // Subsubcase: Independent intersection at record
            record = {
              // the exact record the intersection took place at
              index: isect.crosspoint.index,
              beforeIndex: null,
              afterIndex: null
            };
            // Subsubsubcase: Intersection is at first record
            if (isect.crosspoint.x === seriesA.points[0].x) {
              inAngle = null;
              outAngle = angle;
              transversality = this.getTransversal(intersectionDetails.segs, series, 'start');
            // Subsubsubcase: Intersection is at final record
            } else if (isect.crosspoint.x === seriesA.points.at(-1)!.x) {
              inAngle = angle;
              outAngle = null;
              transversality = this.getTransversal(intersectionDetails.segs, series, 'end');
            // Subsubsubcase: Intersection is at a middle record. Note that such an intersection will create
            //   two overlapping intersection details: one for the segments that precede it and one for 
            //   the segments that follow it. Here we merge the two details, using the first for the
            //   incoming angle and the second for the outgoing angle 
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
          // Subcase: Intersection is between records
          } else {
            record = {
              index: null,
              // the intersection occurred between two record indexes, therefore the prior and post record indexes are populated
              beforeIndex: intersectionDetails.segs[0].start.index,
              afterIndex: intersectionDetails.segs[0].end.index
            };
            inAngle = angle;
            outAngle = angle;
            outAngle.top = this.getTop(intersectionDetails.segs, series, 'end');
            transversality = this.getTransversal(intersectionDetails.segs, series, 'middle')
          }

          const crosspoint = (intersectionDetails.intersection as IntersectionProperties).crosspoint;
          this.intersections.push({
            // the record labels for the intersection
            record,
            // the value of the intersection point, in y-axis units
            dependentValue: crosspoint.y,
            independentValue: crosspoint.x,
            // the list of series labels for all the series that participated in the intersection
            series,
            incomingAngle: this.generateAngleMetadata(inAngle, series) as Angle,
            outgoingAngle: this.generateAngleMetadata(outAngle, series) as Angle,
            transversality
          });
        }
        
        // Collect overlaps
        let currentOverlap = this.blankOverlap(series);
        let liveOverlap = false;
        
        for (let i = 0; i < intersectionsDetails.length; i++) {
          const intersectionDetails = intersectionsDetails[i];

          // Case: Overlap
          if (intersectionDetails.relationship === SegRelationship.Overlap) {
            const start = intersectionDetails.segs[0].start;
            const end = intersectionDetails.segs[0].end;
            
            // Subcase: First segment of overlap
            if (!liveOverlap) {
              currentOverlap.incomingAngle = (i === 0) ? null 
                : this.generateAngleMetadata(this.generateAngleDetails(
                  intersectionsDetails[i-1], series, 'start'
                ), series) as Angle;
              currentOverlap.datapoints.push([start.x.toString(), start.y]);
              currentOverlap.datapoints.push([end.x.toString(), end.y]);
              liveOverlap = true;
            // Subcase: Middle segment of overlap
            } else {
              currentOverlap.datapoints.push([end.x.toString(), end.y]);
            }
          
          // Case: Not overlap
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

        //In case of overlap which ends at the end of the chart
        if (liveOverlap) {
          this.overlaps.push(currentOverlap);
        }

        // Collect Parallels

        const allProps = interactions.allSegPairProps;
        let currentParallel = this.blankParallel(series);
        let liveParallel = false;
        let nParallelSegs = 0;
        
        for (let i = 0; i < allProps.length; i++) {
          const props = allProps[i];

          // Case: Parallel
          if (props.relationship === SegRelationship.Parallel 
              || props.relationship === SegRelationship.FunctionallyParallel) {
            const start = props.segs[0].start;
            const end = props.segs[0].end;
            nParallelSegs++;

            if (props.relationship === SegRelationship.FunctionallyParallel) {
              currentParallel.kind = 'functional';
            }
            
            // Subcase: First segment of parallel
            if (!liveParallel) {
              currentParallel.incomingDirection = (i === 0) ? null 
                : this.determineDirection(allProps[i-1], 'start');
              currentParallel.records.push({ label: start.x.toString() })
              currentParallel.records.push({ label: end.x.toString() })
              liveParallel = true;
            // Subcase: Middle segment of parallel
            } else {
              currentParallel.records.push({ label: end.x.toString() })
            }
          
          // Case: Not parallel
          } else {
            if (liveParallel) {
              currentParallel.outgoingDirection = (i === allProps.length - 1) ? null 
                : this.determineDirection(allProps[i+1], 'end');
              this.parallels.push(structuredClone(currentParallel));
              currentParallel = this.blankParallel(series);
              liveParallel = false;
            }
          }
        }

        //In case of overlap which ends at the end of the chart
        if (liveParallel) {
          this.parallels.push(currentParallel);
        }

        // Collecting pair properties

        this.pairs.push({
          series,
          dominant: (interactions.dominant === -1) ? null : series[interactions.dominant-1],
          dominantPercent: interactions.timeOnTop,
          parallelPercent: (nParallelSegs / allProps.length) * 100
        })
      }
    }

    const { trackingGroups, convergingGroups, divergingGroups } = TrackingGroupBuilder.getGroups(seriesArray, undefined, 0.90);
    this.trackingGroups = trackingGroups.map((tg) => this.generateTrackingGroupMetadata(tg, "tracking"));
    this.convergingGroups = convergingGroups.map((tg) => this.generateTrackingGroupMetadata(tg, "converging"));
    this.divergingGroups = divergingGroups.map((tg) => this.generateTrackingGroupMetadata(tg, "diverging"));
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
  
  private generateAngleDetails(
    intersectionDetails: SegPairProperties, series: [string, string], side: 'start' | 'end'
  ): AngleIncludingOverlapDetails {
    return {
      top: this.getTop(intersectionDetails.segs, series, side),
      angle: (<IntersectionProperties>intersectionDetails.intersection).angle, //TODO: explain cast
      slope: {
        [series[0]]: intersectionDetails.slopes.a, 
        [series[1]]: intersectionDetails.slopes.b
      }
    };
  }

  private generateAngleMetadata(
    angleDetails: AngleIncludingOverlapDetails | null, series: [string, string]
  ): AngleIncludingOverlap | null {
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
    }
  }
  
  private blankOverlap(series: [string, string]): Overlap {
    return {
      datapoints: [],
      series,
      incomingAngle: null,
      outgoingAngle: null,
    }
  }

  private blankParallel(series: [string, string]): Parallel {
    return {
      records: [],
      series,
      incomingDirection: null,
      outgoingDirection: null,
      kind: 'perfect'
    }
  }

  private getTop(segs: [PointInterval, PointInterval], seriesName: [string, string], side: 'start' | 'end'): string | null {
    const topIndex = this.getTopIndex(segs, side);
    if (topIndex === null) {
      return null
    }
    return seriesName[topIndex];
  }

  private getTopIndex(segs: [PointInterval, PointInterval], side: 'start' | 'end'): number | null {
    const yValueA = segs[0][side].y;
    const yValueB = segs[1][side].y;
    if (yValueA > yValueB) {
      return 0
    } else if (yValueA < yValueB) {
      return 1
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
      const testEdge = (edge === 'start' ? 'end' : 'start'); //We need the other edge to work out which series are top/bottom
      topIdx = <number>this.getTopIndex(segs, testEdge);
    } else {
      topIdx = <number>this.getTopIndex(segs, 'start');
      const endTopIdx = <number>this.getTopIndex(segs, 'end');
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
      }
    }
    return {
      kind,
      top: seriesNames[topIdx],
      bottom: seriesNames[bottomIdx]
    }
  }

  private getTransversalOnRecord(
    leftSegs: [PointInterval, PointInterval],
    rightSegs: [PointInterval, PointInterval],
    seriesNames: [string, string], 
  ): Transverse {
    const leftTopIndex = <number>this.getTopIndex(leftSegs, 'start');
    const rightTopIndex = <number>this.getTopIndex(rightSegs, 'end');
    if (leftTopIndex === rightTopIndex) {
      const bottomIdx = +(leftTopIndex === 0);
      return {
        kind: 'touch',
        top: seriesNames[leftTopIndex],
        bottom: seriesNames[bottomIdx]
      }
    } else {
      return {
        kind: 'cross',
        topToBottom: seriesNames[leftTopIndex],
        bottomToTop: seriesNames[rightTopIndex],
      }
    }
  }

  private generateTrackingGroupMetadata(tg: TrackingGroupBuilder, type: "tracking" | "converging" | "diverging"): TrackingGroup {
    return {
      keys: Array.from(tg.keys),
      outliers: tg.outliers(),
      valueInterval: tg.interval,
      averageLine: tg.averageLine().points.map((point) => [point.x, point.y]),
      differentialLines: tg.computeDifferentialLine(tg.keys),
      type: type
    }
  }

  private generateTrackingZoneMetadata(tz: TrackingZoneBuilder): TrackingZone {
    return {
      groups: tz.trackingGroups.map((tg) => this.generateTrackingGroupMetadata(tg, "tracking")),
      valueInterval: [tz.interval.start, tz.interval.end]
    }
  }
}