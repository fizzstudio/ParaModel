import { Line, mapn, Point, PointInterval, slopeToAngle } from "@fizz/chartsignal-internal";

import { IndexedPointInterval, IndexedPoint } from "./pair_analyzer_interface";

// Errors

/**
 * The error codes for Err objects
 */
export const Errors = {
  numPointsNotEqual: 0,
  segStartNotBeforeEnd: 1,
  seriesWithoutKey: 2
};

/**
 * The error messages for Err objects
 */
const ErrorMessages = {
  [Errors.numPointsNotEqual]: 'number of points in each time series must be equal',
  [Errors.segStartNotBeforeEnd]: 'The start x value of a segment must be less than the end x value of the segment.',
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
  crosspoint: IndexedPoint;
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
  segs: [IndexedPointInterval, IndexedPointInterval];
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

// Helper

/**
 * This function determines the segment (in terms of its start & end points) of a series at a given 
 * segment index.
 * @param {Line} series The series including an array of its data points.
 * @param {number} i The index of the segment in the series.
 * @returns {PointInterval} The segment at the index in the series (in terms of its start & end points).
 */
function segAt(series: Line, i: number): IndexedPointInterval {
  return { 
    start: { ...series.points[i], index: i }, 
    end: { ...series.points[i + 1], index: i+1 }
  };
}

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

  constructor(protected series1: Line, protected series2: Line, yScale: number) {
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
  checkIntersection(
    seg1: IndexedPointInterval, 
    seg2: IndexedPointInterval, 
    yScale: number, 
    i: number
  ): SegPairProperties {
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
  private calculateLineIntersectionPoints(
    seg1: IndexedPointInterval, 
    seg2: IndexedPointInterval, 
    segPairProps: SegPairProperties
  ) {
  
    // A line segment A: (a1, a2) is equal to a1 + r where r is just the difference between 
    // our original points (a1 and a2)

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

      // u is already calculated for us in previous uNumerator and Denominator so all we have to do is divide them.
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
        
        segPairProps.relationship = SegRelationship.Intersection;
        segPairProps.intersection = {
          crosspoint: { ...intersection_point, index: seg1.start.index },
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

    // Agreed-upon parallel threshold 
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
   *   NOTE: Horizontal lines are 0. Vertical lines are impossible, as x1 must be strictly greater than x2.
   * @returns the slope as a float.
   */
  findSlope(seg: PointInterval, yScale: number): number {
    // Is this check necessary? If everything else is programmed correctly it shouldn't arise.
    if (seg.end.x <= seg.start.x) {
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
   *   Note that parallel and collinear lines will return an angle of 0.
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