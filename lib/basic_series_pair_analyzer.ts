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

import { Line, mapn, Point, PointInterval, slopeToAngle } from "@fizz/chart-classifier-utils";
import { Overlap, SeriesPairMetadataAnalyzer, Intersection, Parallel, Pair, TrackingGroup, TrackingZone, Angle } from "./series_pair_analyzer";

// Errors

/**
 * The error codes for Err objects
 */
const Errors = {
  numPointsNotEqual: 0,
  segStartNotBeforeEnd: 1,
  seriesWithoutKey: 2
};

/**
 * The error messages for Err objects
 */
const ErrorMessages = {
  [Errors.numPointsNotEqual]: 'number of points in each time series must be equal',
  [Errors.segStartNotBeforeEnd]: 'The start x value of a segment must be greater than the end x value of the segment.',
  [Errors.seriesWithoutKey]: 'Every series must have a key'
};

/**
 * This class provides error messages by error code.
 * @public 
 */
export class Err extends Error {
  /**
   * Constructs the Err class
   * @param code - The code of the error
   */
  constructor(public code: number) {
    super(ErrorMessages[code]);
  }
}

// Types

/**
 * Relationship between two corresponding segments in different series.
 * @public 
 */
export enum SegRelationship {
  Intersection,
  Disjoint,
  Overlap,
  Parallel,
  FunctionallyParallel
}

/**
 * Properties of an intersection between two segments.
 * @public
 */
export interface IntersectionProperties {
  /** Point of intersection */
  crosspoint: Point;
  /** Angle of intersection */
  angle: number;
  /** Whether intersection occurs on a record */
  atRecord: boolean;
}

/**
 * Properties of two corresponding segments in different series.
 * @public
 */
export interface SegPairProperties {
  /** Index of segments in their series */
  i: number;
  /** The endpoints of each segment */
  segs: [PointInterval, PointInterval];
  /** Their relationship */
  relationship: SegRelationship;
  /** Segment slopes ???? */
  slopes: {a: number, b: number};
  /** ??? */
  category: string;
  /** Intersection properties */
  intersection: 'None' | IntersectionProperties | 'Overlap';
}

type SlopeClass = 'positive' | 'negative' | 'zero';

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

type TransverseCross = {
  kind: 'cross',
  topToBottom: string,
  bottomToTop: string
}

type TransverseTouchEdge = {
  kind: 'touch' | 'edge',
  top: string,
  bottom: string
}

type Transverse = TransverseCross | TransverseTouchEdge;

// Helper

/**
 * This function determines the segment (in terms of its start & end points) of a series at a given 
 * segment index.
 * @param {Line} series The series including an array of its data points.
 * @param {number} i The index of the segment in the series.
 * @returns {PointInterval} The segment at the index in the series (in terms of its start & end points).
 */
function segAt(series: Line, i: number): PointInterval {
  return {start: series.points[i], end: series.points[i + 1]};
}

// Main

/**
 * Class for detecting whether time series intersect.
 * @public
 */
export class LineIntersectionDetection {
  /** Segment pair properties for all segment pairs */
  public allSegPairProps: SegPairProperties[];
  /** Segment pair properties only for intersecting pairs */
  public intersectingSegPairs: SegPairProperties[];
  /** Segment pair properties only for parallel pairs */
  public parallelSegPairs: SegPairProperties[];
  /** Series with the greatest amount of time above the other (-1 if neither) */
  public dominant: 1 | 2 | -1;
  /** Time (as percentage) spent "on top" by dominant line */
  public timeOnTop: number;
  /** Average distance between the lines */
  public averageGap: number;

  constructor(private series1: Line, private series2: Line, yScale: number) {
    if (series1.length !== series2.length) {
      throw new Err(Errors.numPointsNotEqual);
    }
    this.allSegPairProps = mapn(series1.length - 1, 
      i => this.checkIntersection(segAt(series1, i), segAt(series2, i), yScale, i)
    );
    this.intersectingSegPairs = this.getIntersections();
    this.parallelSegPairs = this.getParallelSegPairs();
    const {dominant, timeOnTop} = this.findDominant();
    this.dominant = dominant;
    this.timeOnTop = timeOnTop;
    this.averageGap = (series1.points
      .map((p, i) => Math.abs(p.y - series2.points[i].y))
      .reduce((total, diff) => total + diff, 0))/series1.length;
  }

  // This is public only for testing
  getIntersections() {
    return this.allSegPairProps.filter(props => props.intersection !== 'None');
  }

  private getParallelSegPairs() {
    return this.allSegPairProps.filter(props => 
      props.relationship === SegRelationship.Parallel || 
      props.relationship === SegRelationship.FunctionallyParallel);
  }

  private findDominant(): {dominant: 1 | 2 | -1, timeOnTop: number} {
    // x-axis tick interval
    const interval = this.series1.points[1].x - this.series1.points[0].x;
    let series1TimeOnTop = 0;
    this.allSegPairProps.forEach((props, i) => {
      const segs = props.segs;
      if (props.relationship === SegRelationship.Intersection) {
        const isect = props.intersection as IntersectionProperties;
        if (isect.crosspoint.x === segs[0].start.x) {
          // crosspoint is at start record
          if (segs[0].end.y > segs[1].end.y) {
            series1TimeOnTop += interval;
          }
        } else if (isect.crosspoint.x === segs[0].end.x) {
          // crosspoint is at end record
          if (segs[0].start.y > segs[1].start.y) {
            series1TimeOnTop += interval;
          }
        } else {
          // crosspoint is between records
          if (segs[0].start.y > segs[1].start.y) {
            // seg1 is on top first
            series1TimeOnTop += isect.crosspoint.x - segs[0].start.x;
          } else {
            // seg1 is on top last
            series1TimeOnTop += segs[0].end.x - isect.crosspoint.x;
          }
        }
      } else if (props.relationship !== SegRelationship.Overlap) {
        // One seg is entirely above the other
        if (segs[0].start.y > segs[1].start.y) {
          series1TimeOnTop += interval;
        }
      }
    });
    // Convert to percentage
    series1TimeOnTop /= (this.series1.points.at(-1)!.x - this.series1.points[0].x);
    const dominant = series1TimeOnTop > 0.5 ? 1 : 
                     series1TimeOnTop < 0.5 ? 2 : 
                     -1;
    return {dominant, timeOnTop: dominant === 1 ? series1TimeOnTop : 1 - series1TimeOnTop};
  }

  /**
   * Check for the relationship between two lines. 
   * Uses a vector cross-product approach described on StackOverflow:
   * http://stackoverflow.com/a/565282/786339
   */
  // This is only public for testing
  checkIntersection(seg1: PointInterval, seg2: PointInterval, yScale: number, i: number): SegPairProperties {
    const slope1 = this.findSlope(seg1, yScale);
    const slope2 = this.findSlope(seg2, yScale);

    let segPairProps: SegPairProperties = {
      i,
      segs: [seg1, seg2],
      relationship: SegRelationship.Disjoint,
      slopes: {
        a: slope1, 
        b: slope2,
      },
      category: '', //TODO: add categories?
      intersection: 'None'
    };

    // Fast path 1: special disjoint case where line ranges don't overlap
    if (Math.max(seg1.start.y, seg1.end.y) < Math.min(seg2.start.y, seg2.end.y) || 
        Math.min(seg1.start.y, seg1.end.y) > Math.max(seg2.start.y, seg2.end.y)) {
      segPairProps.relationship = this.getParallelApproximation(segPairProps.slopes.a, segPairProps.slopes.b);
    // Fast path 2: check for intersections at start or end points (including overlaps)
    } else if (seg1.start.y === seg2.start.y || seg1.end.y === seg2.end.y) {
      //segPairProps.category = 'first_pass';

      // Intersection at start or end
      if (seg1.end.y !== seg2.end.y || seg1.start.y !== seg2.start.y) {
        segPairProps.relationship = SegRelationship.Intersection;
        segPairProps.intersection = {
          crosspoint: seg1.end.y !== seg2.end.y ? seg1.start : seg1.end,
          angle: this.findAngle(slope1, slope2),
          atRecord: true
        }
      // Segments overlap
      } else {
        segPairProps.relationship = SegRelationship.Overlap;
        segPairProps.intersection = 'Overlap';
      }
    // Slow path: check for intersections between start & end point
    } else {
      // NB: This method mutates segPairProps
      this.calculateLineIntersectionPoints(seg1, seg2, segPairProps);
    }
    return segPairProps;
  }

  /**
   * Check for the relationship between two lines. 
   * Uses a vector cross-product approach described on StackOverflow:
   * http://stackoverflow.com/a/565282/786339
   *  
   * The formula expressed in this module takes advantage of vector representations for number lines. 
   * A typical numberline is expressed in start and end points on an x, y plane or axis.Example line:
   * 
   * p (1,2) as the startpoint
   * p2 (3,6) as the endpoint 
   * 
   * Points on a number line can also be expressed as a 2 x 1 vector
   *  p = |1|
   *      |2|
   * 
   * And therefore line segments are expressed by vector addition: 
   * p + r where 
   * p = original point on the number line.
   * r = the transformation. This can de thought of as the difference, or change between point p and point p2.
   * 
   * this means r = p2 - p.    
   * 
   * so in the above points r = (2, 3) of r = |2|
   *                                          |3|
   *   
   * p in this case is the same as the above. It is the startpoint of the number line.
   * 
   * The rest of this function references the above formula fairly closely. 
   */
  private calculateLineIntersectionPoints(seg1: PointInterval, seg2: PointInterval, segPairProps: SegPairProperties) {
  
    // A line segment A: (a1, a2) is equal to a1 + r where r is just the difference between 
    // our original poitns (a1 and a2)

    // Find difference the start points from the end points. This gives us scalars r & s. They have 
    // been renamed diff1 and diff2
    const diff1 = this.subtractPoints(seg1.end, seg1.start);
    const diff2 = this.subtractPoints(seg2.end, seg2.start);
  
    //Here we find the numerator and the denominator for our equation: u = (p − q) × r / (s × r)
    // uNumerator = (p − q) × r 
    const uNumerator = this.crossProduct(this.subtractPoints(seg2.start, seg1.start), diff1);
    // denominator = (s × r)
    const denominator = this.crossProduct(diff1, diff2);
  
    // check for parallel
    if (denominator === 0 && uNumerator !== 0) {
      // NOTE: this if statement may become redundant
      // lines are parallel
      segPairProps.relationship = SegRelationship.Parallel;
    } else {
      // check for intersection or disjoint

      // Find the scalars t & U. A scalar is any real number that can scale (change the size) of
      // a line (vector). For example (3,3) is a line (1,1) that has been scaled by 3
      // Treat lines as vectors; two lines intersect if we can find scalars t & r & such that: 
      // p + t*r == q + u*s.

      // Scalars are found with these formula:
      // u = (q − p) × r / (r × s)
      // t = (q − p) × s / (r × s)

      // u is alread calculated for us in previous uNumerator and Denominator so all we hve to do is divide them.
      const u_scalar = uNumerator / denominator;
      const t_scalar = this.crossProduct(this.subtractPoints(seg2.start, seg1.start), diff1) / denominator;

      // check for intersection
      if ((t_scalar >= 0) && (t_scalar <= 1) && (u_scalar >= 0) && (u_scalar <= 1)) {
        // lines are intersecting

        // Under this if statement we know the lines are intersecting, so we can skip having to 
        // check both TR and UR and instead just find the intersection point.

        // According to the formula, we apply this scalar *only* to the final vector, or point.
        // Take the vector difference for the first line and apply our scalar value.  
        let scaled_difference: Point = {x: (diff1.x*t_scalar), y: (diff1.y*t_scalar)};

        // Calculate the intersection point and compare. They should be equal. 
        const intersection_point = this.addPoints(scaled_difference, seg1.start);
        
        // console.log(`tr x = ${tr.x} us x = ${us.x} tr y = ${tr.y} us y = ${us.y} `);

        segPairProps.relationship = SegRelationship.Intersection;
        segPairProps.intersection = {
          crosspoint: intersection_point,
          //NOTE: the left and right angles here will be the same
          angle: this.findAngle(segPairProps.slopes.a, segPairProps.slopes.b),
          atRecord: false
        }
      } else {
        // lines are disjoint or functionally parallel
        this.getParallelApproximation(segPairProps.slopes.a, segPairProps.slopes.b);
      }
    }    
  }

  /**
   */
  private getParallelApproximation (slope1: number, slope2: number): SegRelationship {
    const slopeAngle1 = slopeToAngle(slope1);
    const slopeAngle2 = slopeToAngle(slope2);

    // Agreed-upon parallel threhold 
    const PARALLEL_THRESHOLD = 5;

    // If the difference between the two slopes is less than 5, these lines are functionally parallel.
    const abs_difference = Math.abs(slopeAngle1 - slopeAngle2); 

    // Iff lines are perfectly equal, they are perfectly parallel. If they are less than threshold,
    //  they're functionally parallel. Otherwise they are disjointed. 
    if (slopeAngle1 === slopeAngle2) {
      return SegRelationship.Parallel;
    } else if (abs_difference < PARALLEL_THRESHOLD) {
      return SegRelationship.FunctionallyParallel;
    } else {
      return SegRelationship.Disjoint
    }
  }

  /**
   * Find the apparent slope/gradient of a segment, scaled to the x and y ranges that the graph displays.
   *   NOTE:  run can always be considered 1, as the two points of a segment are adjacent.
   *   NOTE: Horizontal lines are 0. Verticle lines are impossible, as x1 must be strictly greater than x2.
   * @returns the slope as a float.
   */
  findSlope(seg: PointInterval, yScale: number): number {
    // Is this check necessary? If everything else is programmed correctly it shouldn't arise.
    if (seg.end.x <= seg.start.x) {
      // FIXME: do we assume seg.end.x === seg.start.x + 1 ??
      if (seg.end.x !== seg.start.x + 1) { console.log('seg.end.x === seg.start.x + 1', seg) }
      throw new Err(Errors.segStartNotBeforeEnd);
    }
    const rise = seg.end.y -  seg.start.y;
    const scaledRise = rise * yScale;
    // NOTE: this check is not strictly necessary, as division of a zero returns zero anyway, but it does
    //        make things clearer
    if (scaledRise === 0) {
      return 0;
    }
    const run = 1;
    return (scaledRise / run);
  }

  /**
   * Calculate the cross product of two points.
   * @param point1 - point object with x and y coordinates
   * @param point2 - point object with x and y coordinates
   * @returns The cross product result as a float
   */    
  private crossProduct(point1: Point, point2: Point) {
    return point1.x*point2.y - point1.y*point2.x;
  }
  
  /**
   * Subtracts the second point from the first.
   * @param point1 - point object with x and y coordinates
   * @param point2 - point object with x and y coordinates
   * @returns The subtraction result as a point object
   */ 
  private subtractPoints (point1: Point, point2: Point): Point {
    return {x: point1.x - point2.x, y: point1.y - point2.y};
  }

  /**
   * Add two points.
   * @param point1 - point object with x and y coordinates
   * @param point2 - point object with x and y coordinates
   * @returns The addition result as a point object
   */ 
  private addPoints (point1: Point, point2: Point): Point {
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
      return true
    }
    if (slope2 === 'positive' && slope1 === 'negative') {
      return true
    }
    return false
  }

  // NOTE: if lineAt45DegreesY == startTopY then acuteAngle == obtuseAngle == 90
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
    return acuteAngle
  }

  /**
   * Finds the acute angle of intersection between two line segments, using their slopes. 
   *   Note that parallel and colinear lines will return an angle of 0.
   * @param m1 - the numeric value of the first slope.
   * @param m2 - the numeric value of the second slope.
   * @returns the acute angle of intersection in degrees.
   */
  private findLineIntersectionAngle(m1: number, m2: number) {
    // Store the tan of the angle.
    const tan_of_angle = Math.abs((m2 - m1) / (1 + (m1 * m2)));
    // Calculate the inverse tan of the tan of the angle then 
    //   convert the angle from radians to degrees
    return slopeToAngle(tan_of_angle);
  }
}

export class BasicSeriesPairMetadataAnalyzer implements SeriesPairMetadataAnalyzer {
  intersections: Intersection[];
  overlaps: Overlap[];
  parallels: Parallel[];
  pairs: Pair[];
  trackingGroups: TrackingGroup[];
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
        const series = <[string, string]>[seriesA.key, seriesB.key];

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
          const isect = <IntersectionProperties>intersectionDetails.intersection;
          let record;
          const angle = this.generateAngleDetails(intersectionDetails, series, 'start')
          let inAngle;
          let outAngle;
          let transversality;
          
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
              label: isect.crosspoint.x.toString(),
              before: null,
              after: null
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
                angle: (<IntersectionProperties>nextIntersectionDetails.intersection).angle, //TODO: explain cast
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
              label: null,
              // the intersection occurred between two record indexes, therefore the prior and post record labels are populated
              before: intersectionDetails.segs[0].start.x.toString(),
              after: intersectionDetails.segs[0].end.x.toString()
            };
            inAngle = angle;
            outAngle = angle;
            outAngle.top = this.getTop(intersectionDetails.segs, series, 'end');
            transversality = this.getTransversal(intersectionDetails.segs, series, 'middle')
          }

          this.intersections.push({
            // the record labels for the intersection
            record,
            // the value of the intersection point, in y-axis units
            value: (<IntersectionProperties>intersectionDetails.intersection).crosspoint.y, // TODO: explain cast
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
    return [];
  }

  getTrackingZones(): TrackingZone[] {
    return [];
  }

  getClusters(): string[][] {
    return [];
  }

  getClusterOutliers(): string[] {
    return [];
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
}