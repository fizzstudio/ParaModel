import { linearRegression, max, min } from "./simple-statistics-min";

/** @public */
export class MinLenError extends Error {
  constructor(n: number) {
    super(`line must have at least ${n} points`);
  }
}

/** @public */
export class ArrayLenError extends Error {
  constructor() {
    super('The first array in a zipped array must not be longer than the second.');
  }
}

/**
 * A numeric interval.
 * @public 
 * @remarks
 * Whether the interval is taken as open or closed is left to client code.
 */
export type Interval = { start: number, end: number };

/**
 * A 2-D point. 
 * @public 
 */
export type Point = { x: number, y: number };

/**
 * The two endpoints of an interval on a chart.
 * @public 
 */
export type PointInterval = { start: Point, end: Point };

/**
 * A 2-D width and height.
 * @public
 */
export type Size2d = { width: number, height: number };


/**
 * (x, y) size of common coordinate system splitter model training data is
 * projected into.
 * @public
 */
export const coordSysSize: Size2d = { width: 3, height: 1 };

/**
 * Project a point into another coordinate system.
 * @param point - The point.
 * @param xAxis - Source chart display x-axis bounds.
 * @param yAxis - Source chart display y-axis bounds.
 * @param destSize - Destination coordinate system size.
 * @returns Projected point.
 * @public
 */
export function projectPoint(
  point: Point,
  xAxis: Interval,
  yAxis: Interval,
  destSize: Size2d
): Point {
  let { start: minY, end: maxY } = yAxis;
  if (minY === maxY) {
    // chart is a perfect horizontal line
    minY -= 1;
    maxY += 1;
  }
  return {
    x: (point.x - xAxis.start)*destSize.width/(xAxis.end - xAxis.start),
    y: (point.y - minY)*destSize.height/(maxY - minY)
  };
}

/**
 * Convert a line slope into an angle in degrees.
 * @remarks
 * This is the acute angle (of the two possible angles), and it will be
 * negative if the slope is negative.
 * @param slope - Slope.
 * @returns Angle in degrees.
 * @public
 */
export function slopeToAngle(slope: number) {
  return Math.atan(slope)*180/Math.PI;
}

/**
 * Map a function over all ints from 0 to n - 1.
 * @param n - n.
 * @param fn - the function.
 * @returns Array of function results.
 * @public
 */
export function mapn<T>(n: number, fn: (n: number) => T) {
  const ary = [];
  for (let i = 0; i < n; i++) {
    ary.push(fn(i));
  }
  return ary;
}

/**
 * Zip two arrays into an array of pairs, where the nth pair contains the nth element from each of the
 * parameter arrays.
 * @param shorterArray - An array of objects, which may not be longer than the other array.
 * @param longerArray - An array of objects, which may not be shorter than the other array.
 * @returns Array of pairs
 * @public
 */
export function zip<TL, TR>(shorterArray: TL[], longerArray: TR[]): [TL, TR][] {
  if (shorterArray.length > longerArray.length) {
    throw new ArrayLenError();
  }
  return shorterArray.map(function(e, i) { return [e, longerArray[i]]; });
}

/**
 * A sequence of connected 2-D points.
 * @public
 */
export class Line {
  private computedBestFit?: BestFitLine = undefined;

  /**
   * @param points - The line's points.
   * @param key - Optional string key for identifying the line.
   */
  constructor(public points: Point[], public key?: string) { }

  /**
   * Create a new Line from an array of y-values.
   * @param values - Y-values.
   * @param key - Optional string key for identifying the line.
   * @returns New Line.
   */
  static fromValues(values: number[], key?: string) {
    // NB: value indices are used as x-coordinates
    return new Line(values.map((y, i) => ({ x: i, y })), key);
  }

  /**
   * Generate a straight line given starting and ending y-values.
   * @param y1 - Starting y-value.
   * @param y2 - Ending y-value.
   * @param n - Number of points.
   * @param startX - Optional starting x-value.
   * @param xStep - Optional x step value.
   * @param key - Optional string key for identifying the line.
   * @returns New Line.
   */
  static generate(startY: number, endY: number, n: number, startX = 0, xStep = 1, key?: string) {
    const yRange = endY - startY;
    const yStep = yRange/(n - 1);
    const data: Point[] = [{ x: startX, y: startY }];
    for (let i = 1; i < n - 1; i++) {
      data.push({ x: startX + i*xStep, y: startY + i*yStep });
    }
    data.push({ x: startX + data.length*xStep, y: endY });
    return new Line(data, key);
  }

  /**
   * Number of points in the line.
   */
  get length(): number {
    return this.points.length;
  }

  /**
   * Get a sub-sequence of the line.
   * @param start - As in Array.prototype.slice().
   * @param end - As in Array.prototype.slice().
   * @returns The slice.
   */
  slice(start?: number, end?: number) {
    return new Line(this.points.slice(start, end));
  }

  /**
   * Create a new line by concatenating the line with another line.
   * @param line - The other line.
   * @returns The new line.
   */
  concat(line: Line) {
    return new Line(this.points.concat(line.points));
  }

  /**
   * Inserts new points at the start of the line.
   * @param points - New points.
   * @returns New number of points in the line.
   */
  unshift(... points: Point[]) {
    if (points.length) {
      this.computedBestFit = undefined;
      return this.points.unshift(...points);
    }
    return this.points.length;
  }

  /**
   * Removes the first point of the line.
   * @returns The removed point.
   */
  shift(): Point {
    this.computedBestFit = undefined;
    return this.points.shift()!;
  }

  /**
   * Inserts new points at the end of the line.
   * @param points - New points.
   * @returns New number of points in the line.
   */
  push(... points: Point[]) {
    if (points.length) {
      this.computedBestFit = undefined;
      return this.points.push(...points);
    }
    return this.points.length;
  }

  /**
   * Removes the last point of the line.
   * @returns The removed point.
   */
  pop(): Point {
    this.computedBestFit = undefined;
    return this.points.pop()!;
  }

  /**
   * Extract a section of the line within an x-value interval.
   * If one or both interval bounds fall between existing points,
   * (a) new endpoint(s) will be produced via interpolation. 
   * @param interval - The x-value interval of the line section to extract.
   * @returns The extracted line section.
   */
  extractSection(interval: Interval): Line | undefined {
    if (interval.end < interval.start ||
      interval.start > this.points.at(-1)!.x ||
      interval.start < this.points[0].x ||
      interval.end < this.points[0].x ||
      interval.end > this.points.at(-1)!.x) {
      return undefined;
    }
    const startI = this.points.findIndex(p => p.x >= interval.start);
    let endI = this.points.findIndex(p => p.x > interval.end) - 1;
    if (endI === -2) {
      endI = this.points.length - 1;
    }
    const slice = this.slice(startI, endI + 1);
    const needStartInterp = this.points[startI].x > interval.start;
    const needEndInterp = this.points[endI].x < interval.end;
    if (!needStartInterp && !needEndInterp) {
      return slice;
    }
    const dx = this.points[1].x - this.points[0].x;
    if (needStartInterp) {
      const interp = (interval.start - this.points[startI - 1].x)/dx;
      slice.unshift({
        x: interval.start, 
        y: this.points[startI - 1].y + (this.points[startI].y - this.points[startI - 1].y)*interp
      });
    }
    if (needEndInterp && interval.start !== interval.end) {
      const interp = (interval.end - this.points[endI].x)/dx;
      slice.push({
        x: interval.end, 
        y: this.points[endI].y + (this.points[endI + 1].y - this.points[endI].y)*interp
      });
    }
    return slice;
  }

  /**
   * Project line into another coordinate system.
   * @param xAxis - Source chart display x-axis bounds.
   * @param yAxis - Source chart display y-axis bounds.
   * @param destSize - Destination coordinate system size (default: the shared training coord sys).
   * @returns Projected line.
   */
  project(
    xAxis?: Interval,
    yAxis?: Interval,
    destSize = coordSysSize
  ): Line {
    return new Line(this.points.map(p =>
      projectPoint(p, xAxis ?? this.xBounds(), yAxis ?? this.yBounds(), destSize)));
  }

  /**
   * Compute line's min and max x-values.
   * @returns X bounds.
   */
  xBounds(): Interval {
    return { start: this.points[0].x, end: this.points.at(-1)!.x };
  }

  /**
   * Compute line's min and max y-values.
   * @returns Y bounds.
   */
  yBounds(): Interval {
    const ys = this.points.map(p => p.y);
    return { start: min(ys), end: max(ys) };
  }

  /**
   * Compute the magnitude of the x-value range covered by the line.
   * @returns X-value range.
   */
  xRange(): number {
    const xBounds = this.xBounds();
    return xBounds.end - xBounds.start;
  }

  /**
   * Compute the magnitude of the y-value range covered by the line.
   * @returns Y-value range.
   */
  yRange(): number {
    const yBounds = this.yBounds();
    return yBounds.end - yBounds.start;
  }

  /**
   * Extract the line segments comprising the line.
   * @returns The line segments.
   */
  getSegments() {
    return this.points.slice(0, -1).map((p, i) => 
      new LineSegment({start: p, end: this.points[i + 1]}));
  }

  /**
   * Get the best-fit straight line approximating this line. 
   * @returns Best-fit line.
   */
  get bestFit() {
    if (!this.computedBestFit) {
      this.computedBestFit = new BestFitLine(this);
    }
    return this.computedBestFit;
  }

}


/**
 * A mathematical line segment (i.e., slice of a straight line
 * bounded by two endpoints.)
 * @public
 */
export class LineSegment {
  protected computedSlope?: number
  protected computedAngle?: number

  /**
   * @param endpoints - Endpoints of the segment.
   */
  constructor(public readonly endpoints: PointInterval) { }

  /**
   * Slope of the segment.
   */
  get slope() {
    if (this.computedSlope === undefined) {
      this.computedSlope = (this.endpoints.end.y - this.endpoints.start.y)/
        (this.endpoints.end.x - this.endpoints.start.x);
    }
    return this.computedSlope;
  }

  /** Angle of the segment with the x-axis. */
  get xAngle() {
    if (this.computedAngle === undefined) {
      this.computedAngle = slopeToAngle(this.slope);
    }
    return this.computedAngle;
  }

}

/**
 * The best-fit straight line approximating a given Line instance.
 * @public
 */
export class BestFitLine extends LineSegment {
  public readonly intercept: number;
  public readonly points: Point[];
  public readonly residuals: number[];

  /**
   * @param line - Line to approximate.
   */
  constructor(private line: Line) {
    if (line.length < 3) {
      throw new MinLenError(3);
    }
    const regLine = linearRegression(line.points.map(p => [p.x, p.y]));
    const points = line.points.map(p => ({ x: p.x, y: regLine.m*p.x + regLine.b }));
    super({ start: points[0], end: points.at(-1)! });
    this.computedSlope = regLine.m;
    this.intercept = regLine.b;
    this.points = points;
    this.residuals = line.points.map((p, i) => p.y - points[i].y);
  }

  /**
   * Compute the residual sum of squares.
   * @returns Residual sum of squares.
   */
  rss() {
    return this.residuals.map(r => r**2).reduce((a, b) => a + b);
  }

}