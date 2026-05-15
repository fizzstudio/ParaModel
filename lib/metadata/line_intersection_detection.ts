/* ParaModel: Line Intersection Detection
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

import { Line, mapn, Point, PointInterval, slopeToAngle } from '@fizz/chart-classifier-utils';

import { IndexedPoint, IndexedPointInterval } from './pair_analyzer_interface';

export const Errors = {
  numPointsNotEqual: 0,
  segStartNotBeforeEnd: 1,
  seriesWithoutKey: 2
};

const ErrorMessages = {
  [Errors.numPointsNotEqual]: 'number of points in each time series must be equal',
  [Errors.segStartNotBeforeEnd]: 'The start x value of a segment must be less than the end x value of the segment.',
  [Errors.seriesWithoutKey]: 'Every series must have a key'
};

export class Err extends Error {
  constructor(public code: number) {
    super(ErrorMessages[code]);
  }
}

export enum SegRelationship {
  Intersection,
  Disjoint,
  Overlap,
  Parallel,
  FunctionallyParallel
}

export interface IntersectionProperties {
  crosspoint: IndexedPoint;
  angle: number;
  atRecord: boolean;
}

export interface SegPairProperties {
  i: number;
  segs: [IndexedPointInterval, IndexedPointInterval];
  relationship: SegRelationship;
  slopes: {a: number, b: number};
  category: string;
  intersection: 'None' | IntersectionProperties | 'Overlap';
}

type SlopeClass = 'positive' | 'negative' | 'zero';

function segAt(series: Line, i: number): IndexedPointInterval {
  return {
    start: { ...series.points[i], index: i },
    end: { ...series.points[i + 1], index: i + 1 }
  };
}

export class LineIntersectionDetection {
  public allSegPairProps: SegPairProperties[];
  public intersectingSegPairs: SegPairProperties[];
  public parallelSegPairs: SegPairProperties[];
  public dominant: 1 | 2 | -1;
  public timeOnTop: number;
  public averageGap: number;

  constructor(protected series1: Line, protected series2: Line, yScale: number) {
    if (series1.length !== series2.length) {
      throw new Err(Errors.numPointsNotEqual);
    }
    this.allSegPairProps = mapn(series1.length - 1,
      i => this.checkIntersection(segAt(series1, i), segAt(series2, i), yScale, i)
    );
    this.intersectingSegPairs = this.getIntersections();
    this.parallelSegPairs = this.getParallelSegPairs();
    const { dominant, timeOnTop } = this.findDominant();
    this.dominant = dominant;
    this.timeOnTop = timeOnTop;
    this.averageGap = (series1.points
      .map((p, i) => Math.abs(p.y - series2.points[i].y))
      .reduce((total, diff) => total + diff, 0)) / series1.length;
  }

  getIntersections() {
    return this.allSegPairProps.filter(props => props.intersection !== 'None');
  }

  private getParallelSegPairs() {
    return this.allSegPairProps.filter(props =>
      props.relationship === SegRelationship.Parallel ||
      props.relationship === SegRelationship.FunctionallyParallel);
  }

  private findDominant(): {dominant: 1 | 2 | -1, timeOnTop: number} {
    const interval = this.series1.points[1].x - this.series1.points[0].x;
    let series1TimeOnTop = 0;
    this.allSegPairProps.forEach((props) => {
      const segs = props.segs;
      if (props.relationship === SegRelationship.Intersection) {
        const isect = props.intersection as IntersectionProperties;
        if (isect.crosspoint.x === segs[0].start.x) {
          if (segs[0].end.y > segs[1].end.y) {
            series1TimeOnTop += interval;
          }
        } else if (isect.crosspoint.x === segs[0].end.x) {
          if (segs[0].start.y > segs[1].start.y) {
            series1TimeOnTop += interval;
          }
        } else {
          if (segs[0].start.y > segs[1].start.y) {
            series1TimeOnTop += isect.crosspoint.x - segs[0].start.x;
          } else {
            series1TimeOnTop += segs[0].end.x - isect.crosspoint.x;
          }
        }
      } else if (props.relationship !== SegRelationship.Overlap) {
        if (segs[0].start.y > segs[1].start.y) {
          series1TimeOnTop += interval;
        }
      }
    });
    series1TimeOnTop /= (this.series1.points.at(-1)!.x - this.series1.points[0].x);
    const dominant = series1TimeOnTop > 0.5 ? 1 :
      series1TimeOnTop < 0.5 ? 2 :
      -1;
    return {dominant, timeOnTop: dominant === 1 ? series1TimeOnTop : 1 - series1TimeOnTop};
  }

  checkIntersection(
    seg1: IndexedPointInterval,
    seg2: IndexedPointInterval,
    yScale: number,
    i: number
  ): SegPairProperties {
    const slope1 = this.findSlope(seg1, yScale);
    const slope2 = this.findSlope(seg2, yScale);

    const segPairProps: SegPairProperties = {
      i,
      segs: [seg1, seg2],
      relationship: SegRelationship.Disjoint,
      slopes: {
        a: slope1,
        b: slope2,
      },
      category: '',
      intersection: 'None'
    };

    if (Math.max(seg1.start.y, seg1.end.y) < Math.min(seg2.start.y, seg2.end.y) ||
        Math.min(seg1.start.y, seg1.end.y) > Math.max(seg2.start.y, seg2.end.y)) {
      segPairProps.relationship = this.getParallelApproximation(segPairProps.slopes.a, segPairProps.slopes.b);
    } else if (seg1.start.y === seg2.start.y || seg1.end.y === seg2.end.y) {
      if (seg1.end.y !== seg2.end.y || seg1.start.y !== seg2.start.y) {
        segPairProps.relationship = SegRelationship.Intersection;
        segPairProps.intersection = {
          crosspoint: seg1.end.y !== seg2.end.y ? seg1.start : seg1.end,
          angle: this.findAngle(slope1, slope2),
          atRecord: true
        };
      } else {
        segPairProps.relationship = SegRelationship.Overlap;
        segPairProps.intersection = 'Overlap';
      }
    } else {
      this.calculateLineIntersectionPoints(seg1, seg2, segPairProps);
    }
    return segPairProps;
  }

  private calculateLineIntersectionPoints(
    seg1: IndexedPointInterval,
    seg2: IndexedPointInterval,
    segPairProps: SegPairProperties
  ) {
    const diff1 = this.subtractPoints(seg1.end, seg1.start);
    const diff2 = this.subtractPoints(seg2.end, seg2.start);
    const uNumerator = this.crossProduct(this.subtractPoints(seg2.start, seg1.start), diff1);
    const denominator = this.crossProduct(diff1, diff2);

    if (denominator === 0 && uNumerator !== 0) {
      segPairProps.relationship = SegRelationship.Parallel;
    } else {
      const uScalar = uNumerator / denominator;
      const tScalar = this.crossProduct(this.subtractPoints(seg2.start, seg1.start), diff1) / denominator;

      if ((tScalar >= 0) && (tScalar <= 1) && (uScalar >= 0) && (uScalar <= 1)) {
        const scaledDifference: Point = {x: (diff1.x * tScalar), y: (diff1.y * tScalar)};
        const intersectionPoint = this.addPoints(scaledDifference, seg1.start);

        segPairProps.relationship = SegRelationship.Intersection;
        segPairProps.intersection = {
          crosspoint: { ...intersectionPoint, index: seg1.start.index },
          angle: this.findAngle(segPairProps.slopes.a, segPairProps.slopes.b),
          atRecord: false
        };
      } else {
        this.getParallelApproximation(segPairProps.slopes.a, segPairProps.slopes.b);
      }
    }
  }

  private getParallelApproximation(slope1: number, slope2: number): SegRelationship {
    const slopeAngle1 = slopeToAngle(slope1);
    const slopeAngle2 = slopeToAngle(slope2);
    const parallelThreshold = 5;
    const absDifference = Math.abs(slopeAngle1 - slopeAngle2);

    if (slopeAngle1 === slopeAngle2) {
      return SegRelationship.Parallel;
    } else if (absDifference < parallelThreshold) {
      return SegRelationship.FunctionallyParallel;
    } else {
      return SegRelationship.Disjoint;
    }
  }

  findSlope(seg: PointInterval, yScale: number): number {
    if (seg.end.x <= seg.start.x) {
      throw new Err(Errors.segStartNotBeforeEnd);
    }
    const rise = seg.end.y - seg.start.y;
    const scaledRise = rise * yScale;
    if (scaledRise === 0) {
      return 0;
    }
    return scaledRise;
  }

  private crossProduct(point1: Point, point2: Point) {
    return point1.x * point2.y - point1.y * point2.x;
  }

  private subtractPoints(point1: Point, point2: Point): Point {
    return {x: point1.x - point2.x, y: point1.y - point2.y};
  }

  private addPoints(point1: Point, point2: Point): Point {
    return {
      x: Number((point1.x + point2.x).toFixed(3)),
      y: Number((point1.y + point2.y).toFixed(3))
    };
  }

  private getSlopeClass(slope: number): SlopeClass {
    if (slope > 0) {
      return 'positive';
    }
    if (slope < 0) {
      return 'negative';
    }
    return 'zero';
  }

  private oppositeSlopes(slope1: SlopeClass, slope2: SlopeClass): boolean {
    if (slope1 === 'positive' && slope2 === 'negative') {
      return true;
    }
    if (slope2 === 'positive' && slope1 === 'negative') {
      return true;
    }
    return false;
  }

  private findAngle(slope1: number, slope2: number): number {
    const acuteAngle = this.findLineIntersectionAngle(slope1, slope2);
    const slopeClass1 = this.getSlopeClass(slope1);
    const slopeClass2 = this.getSlopeClass(slope2);
    if (this.oppositeSlopes(slopeClass1, slopeClass2)) {
      const [posSlope, negSlope] = (slopeClass1 === 'positive') ? [slope1, slope2] : [slope2, slope1];
      const negSlopePerpendicular = -1 / negSlope;
      if (posSlope > negSlopePerpendicular) {
        return 180 - acuteAngle;
      }
    }
    return acuteAngle;
  }

  private findLineIntersectionAngle(m1: number, m2: number) {
    const tanOfAngle = Math.abs((m2 - m1) / (1 + (m1 * m2)));
    return slopeToAngle(tanOfAngle);
  }
}
