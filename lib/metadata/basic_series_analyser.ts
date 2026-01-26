import { Line, Point } from "@fizz/chart-classifier-utils";
import * as ss from 'simple-statistics';

import { Category, RunInfo, SegmentInfo, SequenceInfo, SeriesStats, SingleSeriesMetadataAnalyzer } from "./series_analyzer_interface";
import { Memoize } from "typescript-memoize";

function getLabelsAtValue(points: Point[], value: number): string[] {
  return points.filter((point) => point.y === value).map((point) => `${point.x}`);
}

function range(data: Line) {
  const ys = data.points.map(p => p.y);
  return ss.max(ys) - ss.min(ys);
}

function computeStats(data: Line): SeriesStats {
  const ys = data.points.map(p => p.y);
  const min = ss.min(ys);
  const max = ss.max(ys);
  return {
    min: {
      value: min,
      labels: getLabelsAtValue(data.points, min)
    },
    max: {
      value: max,
      labels: getLabelsAtValue(data.points, max)
    },
    range: range(data),
    mean: ss.mean(ys),
    median: ss.median(ys),
    mode: ss.mode(ys),
  };
}

function slope(p0: Point, p1: Point) {
  return (p1.y - p0.y)/(p1.x - p0.x);
}

function magnitude(series: Line, i: number, j: number, stats: SeriesStats): number {
  if (stats.range === 0) {
    return 1;
  }
  return range(series.slice(i, j))/stats.range;
}

function segArea(series: Line, i: number) {
  const rectHeight = Math.min(series.points[i].y, series.points[i + 1].y);
  const base = series.points[i + 1].x - series.points[i].x;
  const triHeight = Math.max(series.points[i].y, series.points[i + 1].y) - rectHeight;
  return base*(rectHeight + 0.5*triHeight);
}

function computeSegments(series: Line, stats: SeriesStats): SegmentInfo[] {
  return series.slice(0, -1).points.map((p, i) => ({
    i,
    direction: Math.sign(slope(p, series.points[i + 1])) || 0, // convert any -0 to +0
    magnitude: magnitude(series, i, i + 2, stats),
    area: segArea(series, i)
  }));
}

function variance(series: Line, i: number, j: number, stats: SeriesStats): number {
  if (i >= j){
    return 0;
  }
  //1: Get r-squared
  //I think I saw a dedicated formula for this somewhere else in the code, if anyone reading this knows where that is, feel free to replace
  const data = series.slice(i, j);
  const dataArray: Array<Array<number>> = [];
  for (let i = 0; i < data.points.length; i++) {
      dataArray.push([data.points[i]["x"], data.points[i]["y"]])
  }
  const rSquared = 1 - ss.rSquared(dataArray, ss.linearRegressionLine(ss.linearRegression(dataArray)));
  
  //2: Get average second order discrete difference, normalize x and y values so that each x is spaced by 1 and y is scaled to 0-1.
  //If the input x values aren't evenly spaced, they won't be spaced by exactly 1 after normalization, but I don't think that should matter too much
  const x: number[] = [];
  const y: number[] = [];
  const yMin: number = data.yBounds().start;
  const xMin: number = data.xBounds().start;
  for (let i = 0; i < data.points.length; i++) {
    x.push((dataArray[i][0] - xMin) * (data.points.length - 1) / data.xRange());
    y.push((dataArray[i][1] - yMin) / data.yRange());
  }

  const secondDiscreteDiff = [];
  for (let i = 1; i < dataArray.length - 1; i++) {
    //Implements the Second Order Central discrete difference
    secondDiscreteDiff.push(((y[i + 1] - 2 * y[i] + y[i - 1]) / ((x[i] - x[i - 1]) * (x[i + 1] - x[i]))) ** 2);
  }
  const sum = secondDiscreteDiff.reduce((acc, val) => acc + val, 0);
  //Average, then take the inverse tangent to normalize between 0-1.
  const averageSecondDifference: number = data.length < 3 ? 0 : Math.atan(sum/(secondDiscreteDiff.length)) * 2 / Math.PI;
  
  //3. Proportion of direction changes
  let directionChanges: number = 0;
  for (let i = 0; i < dataArray.length - 2; i++) {
    if ((y[i + 2] - y[i + 1]) * (y[i + 1] - y[i]) < 0) {
      directionChanges += 1;
    }
  }
  const dCProportion = directionChanges / (dataArray.length - 2)
  
  //Area above the curve as a proportion of the rectangle spanned, only activates if data forms a run
  /*
  let AUC = 0;
  let direction = data.points[1].y - data.points[0].y
  let isRun = true;
  let isUp = direction < 0 ? true : false
  for (let i = 0; i < data.length - 2; i++){
    if ((data.points[i + 2].y - data.points[i + 1].y) * (data.points[i + 1].y - data.points[i].y) < 0){
      isRun = false;
      break;
    }
  }
  if (isRun) {
    for (let i = 0; i < data.length - 1; i++) {
      let trapezoidArea = (data.points[i + 1].x - data.points[i].x) * (data.points[i + 1].y + data.points[i].y - 2 * data.yBounds().start) / 2
      AUC += trapezoidArea;
    }
    let AOC = (data.xRange() * data.yRange()) - AUC;
    let concavityRatio = data.xRange() == 0 || data.yRange() == 0 ? 0 : AOC / (data.xRange() * data.yRange());
    return data.length < 3 ? 0 : (rSquared + averageSecondDifference + concavityRatio) * data.yRange() / (3 * stats.range);
  }
    */
  const normalizedPoints: number = Math.atan(data.length / 20) * 2 / Math.PI;
  //Weights should add to however many parameters there are
  const weights: Array<number> = [1 / 4, 1, 2, 3 / 4]

  //Average of the metrics, normalized by range of total dataset
  const variance = data.length < 3 ? 0 : (rSquared * weights[0] + averageSecondDifference * weights[1] + dCProportion * weights[2] + normalizedPoints * weights[3]) * data.yRange() / (4 * stats.range);
  return variance
}

function computeRuns(series: Line, stats: SeriesStats, segs: SegmentInfo[]): RunInfo[] {
  const runs: Partial<RunInfo>[] = [{start: 0, direction: segs[0].direction}];
  let last = runs[0];
  for (let i = 1; i < segs.length; i++) {
    const curDir = segs[i].direction;
    if (curDir !== last.direction) {
      last.end = i + 1;
      last.magnitude = magnitude(series, last.start!, last.end!, stats);
      last.variance = variance(series, last.start!, last.end!, stats);
      last.area = segs.slice(last.start!, last.end! - 1).reduce((sum, s) => sum + s.area, 0);
      last = {start: i, direction: curDir};
      runs.push(last);
    }
  }
  last.end = segs.length + 1;
  last.magnitude = magnitude(series, last.start!, last.end!, stats);
  last.variance = variance(series, last.start!, last.end!, stats);
  last.area = segs.slice(last.start!, last.end! - 1).reduce((sum, s) => sum + s.area, 0);
  return runs as RunInfo[];
}

/**
 * Performs all analysis of a single time series in one shot.
 * @public
 */
export class BasicSingleSeriesAnalyzer implements SingleSeriesMetadataAnalyzer {
  /**
   * Perform all analysis of a time series.
   * @param series - Time series
   * @returns Results of the series analysis
   * @remarks
   */
  constructor(private series: Line) { }

  /** Whether the analyzer provides AI-enhanced trend information */
  hasTrends(): boolean {
    return false;
  }

  /** Basic time series statistics */
  @Memoize()
  getStats(): SeriesStats {
    return computeStats(this.series);
  }

  /** Measure of variability in data */
  @Memoize()
  getVariance(): number {
    return variance(this.series, 0, this.series.length, this.getStats());
  }

  /** Area under the series */
  @Memoize()
  getArea(): number {
    return this.getSegments().reduce((sum, s) => sum + s.area, 0);
  }

  /** Message of entire time series */
  getMessage(): Category | null {
    return null;
  }

  /** Indices of sequences that form the message */
  getMessageSeqs(): number[] {
    return [];
  }

  /** Segment (i.e., adjacent pairs of points) info */
  @Memoize()
  getSegments(): SegmentInfo[] {
    return computeSegments(this.series, this.getStats());
  }

  /** Run info */
  @Memoize()
  getRuns(): RunInfo[] {
    return computeRuns(this.series, this.getStats(), this.getSegments());
  }

  /** Sequence info */
  getSequences(): SequenceInfo[] {
    return [];
  }
}

