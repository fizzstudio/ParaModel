import { SlopeInfo, Breakdancer } from '../../breakdancer';
import { Interval, Line, Point } from '../../chart-classifier-utils';
import { linearRegression, linearRegressionLine, max, mean, median, min, mode, rSquared, sampleCorrelation } from '../../simple-statistics-min';

export declare enum Category {
  /** A single rising sequence */
  RT = "Rise",
  /** A single falling sequence */
  FT = "Fall",
  /** A single stable sequence */
  ST = "Stable",
  /** A single sequence that shows a large, rapid increase in value */
  BJ = "BigJump",
  /** A single sequence that shows a large, rapid decrease in value */
  BF = "BigFall",
  /** A falling sequence followed by a rising sequence */
  RR = "ReversalToRise",
  /** A rising sequence followed by a falling sequence */
  RF = "ReversalToFall",
  /** A stable sequence followed by a rising sequence */
  ER = "EmergingRise",
  /** A stable sequence followed by a falling sequence */
  EF = "EmergingFall",
  /** A rising sequence followed by a stable sequence */
  RS = "RiseToStable",
  /** A falling sequence followed by a stable sequence */
  FS = "FallToStable",
  /** A rising sequence followed by a falling sequence and another rising sequence */
  RB = "Rebound",
  /** A falling sequence followed by a rising sequence and another falling sequence */
  TJ = "TemporaryJump",
  /** A falling sequence followed by a short rising sequence at the end of the chart */
  PRR = "PossibleReversalToRise",
  /** A rising sequence followed by a short falling sequence at the end of the chart */
  PRF = "PossibleReversalToFall",
  /** A stable sequence followed by a short rising sequence at the end of the chart */
  PER = "PossibleEmergingRise",
  /** A stable sequence followed by a short falling sequence at the end of the chart */
  PEF = "PossibleEmergingFall",
  /** A rising sequence followed by a short stable sequence at the end of the chart */
  PRS = "PossibleRiseToStable",
  /** A falling sequence followed by a short stable sequence at the end of the chart */
  PFS = "PossibleFallToStable",
  /** A rising sequence followed by a falling sequence and another short rising sequence at the end of the chart */
  PRB = "PossibleRebound",
  /** A falling sequence followed by a rising sequence and another short falling sequence at the end of the chart */
  PTJ = "PossibleTemporaryJump"
}

/**
 * Results of single time series analysis.
 * @public 
 */
export interface SeriesAnalysis {
  /** Basic time series statistics */
  stats: SeriesStats;
  /** Measure of variability in data */
  variance: number;
  /** Correllation coefficient of data */
  correllation: number;
  /** Area under the series */
  area: number;
  /** Message of entire time series */
  message?: Category | null;
  /** Indices of sequences that form the message */
  messageSeqs?: number[];
  /** Segment (i.e., adjacent pairs of points) info */
  segments: SegmentInfo[];
  /** Run info */
  runs: RunInfo[];
  /** Sequence info */
  sequences: SequenceInfo[];
}

/** 
 * Options for SeriesAnalyzer#analyzeSeries().
 * @public 
 */
export interface SeriesAnalysisOpts {
  /** Displayed chart y-axis value bounds; defaults to extreme values of data */
  yAxis?: Interval;
  /** Max angle (in degrees) for 'stable' sequence slope classification */
  candStableAngleCutoff?: number;
  /** Enable compatibility with Chartmob 2 data (default disabled) */
  cm2Compat?: boolean;
  /** Enable or disable Web Worker use (default enabled) */
  useWorker?: boolean;
  maxError?: number;
  maxSegments?: number;
  extremumWeight?: number;
}

/** 
 * A time series statistic which lists a single (y-)value and all the (x-)labels that have that value.
 * @public 
 */
export interface MultiLabelStat {
  value: number;
  labels: string[];
}

/** 
 * Basic time series statistics.
 * @public 
 */
export interface SeriesStats {
  min: MultiLabelStat;
  max: MultiLabelStat;
  range: number;
  mean: number;
  median: number;
  mode: number;
}

/** 
 * Segment (i.e., adjacent pair of points) information.
 * @public 
 */
export interface SegmentInfo {
  /** Index of segment in series */
  i: number;
  /** 1, -1, or 0 (corresponding to rising, falling, stable) */
  direction: number;
  /** Value in range [0, 1]; percentage of series y-value range */
  magnitude: number;
  /** Area under the segment */
  area: number;
}

/** 
 * Run (i.e., series of segments with same direction) information.
 * @public 
 */
export interface RunInfo {
  /** Index of start of run in series */
  start: number;
  /** Index AFTER last index of run in series (like slices) */
  end: number;
  /** 1, -1, or 0 (corresponding to rising, falling, stable) */
  direction: number;
  /** Value in range [0, 1]; percentage of series y-value range */
  magnitude: number;
  /** Measure of variability in data */
  variance: number;
  /** Area under the run */
  area: number;
}

/**
 * Sequence (i.e., region selected by ML line splitter) information. 
 * @public 
 */
export interface SequenceInfo {
  /** Index of start of sequence in series */
  start: number;
  /** Index AFTER last index of sequence in series (like slices) */
  end: number;
  /** Sequence slope information */
  slopeInfo: SlopeInfo;
  /** Value in range [0, 1]; percentage of series y-value range */
  magnitude: number;
  /** Measure of variability in data */
  variance: number;
  /** Area under the sequence */
  area: number;
  /** Sequence message */
  message?: Category | null;
  /** Index of start of sequence message in SERIES */
  messageStart?: number | null;
  /** Index AFTER last index of sequence message in SERIES (like slices) */
  messageEnd?: number | null;
  /** Analysis of the sequence itself, taken as a line */
  subSequenceInfo?: SequenceInfo[];
}


export interface TrendLineStats {
  slope: number;
  intercept: number;
  correllation: number
}

function computeStats(data: Line): SeriesStats {
  const ys = data.points.map(p => p.y);
  const minYs = min(ys);
  const maxYs = max(ys);
  return {
    min: {
      value: minYs,
      labels: getLabelsAtValue(data.points, minYs)
    },
    max: {
      value: maxYs,
      labels: getLabelsAtValue(data.points, maxYs)
    },
    range: range(data),
    mean: mean(ys),
    median: median(ys),
    mode: mode(ys),
  };
}

function getLabelsAtValue(points: Point[], value: number): string[] {
  return points.filter((point) => point.y === value).map((point) => `${point.x}`);
}

function range(data: Line) {
  const ys = data.points.map(p => p.y);
  return max(ys) - min(ys);
}

function slope(p0: Point, p1: Point) {
  return (p1.y - p0.y) / (p1.x - p0.x);
}

function magnitude(series: Line, i: number, j: number, stats: SeriesStats): number {
  if (stats.range === 0) {
    return 1;
  }
  return range(series.slice(i, j)) / stats.range;
}

function segArea(series: Line, i: number) {
  const rectHeight = Math.min(series.points[i].y, series.points[i + 1].y);
  const base = series.points[i + 1].x - series.points[i].x;
  const triHeight = Math.max(series.points[i].y, series.points[i + 1].y) - rectHeight;
  return base * (rectHeight + 0.5 * triHeight);
}
/*
function variance(series: Line, i: number, j: number, stats: SeriesStats): number {
  if (stats.range === 0) {
    return 0;
  }
  const data = series.slice(i, j);
  // average residual magnitude / y range
  return data.length < 3 ? 0 : Math.sqrt(data.bestFit.rss()/data.length) / stats.range;
}
*/
function variance(series: Line, i: number, j: number, stats: SeriesStats): number {
  if (i >= j) {
    return 0;
  }
  //1: Get r-squared
  //I think I saw a dedicated formula for this somewhere else in the code, if anyone reading this knows where that is, feel free to replace
  const data = series.slice(i, j);
  const dataArray: Array<Array<number>> = [];
  for (let i = 0; i < data.points.length; i++) {
    dataArray.push([data.points[i]["x"], data.points[i]["y"]])
  }
  if (data.yRange() == 0) {
    return 0;
  }
  const rSquaredVal = 1 - rSquared(dataArray, linearRegressionLine(linearRegression(dataArray)));

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
  const averageSecondDifference: number = data.length < 3 ? 0 : Math.atan(sum / (secondDiscreteDiff.length)) * 2 / Math.PI;

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
  const variance = data.length < 3 ? 0 : (rSquaredVal * weights[0] + averageSecondDifference * weights[1] + dCProportion * weights[2] + normalizedPoints * weights[3]) * data.yRange() / (4 * stats.range);
  return variance;
}

export function judgeVariance(variance: number): number {
  //'Judges' a numerical variance rating and returns a threshold number
  if (variance < 0 || variance > 1) {
    throw new Error("Error in judgeVariance, input variance is outside 0-1 bounds");
  }

  const descriptors: Array<number> = [0, 1, 2, 3, 4]

  //Overall upper and lower bounds are assumed to be 1 and 0 respectively, these then give the n-1 middle bounds.
  const thresholds: Array<number> = [.10, .20, .30, .45]

  return variance < thresholds[0] ? descriptors[0] :
    variance < thresholds[1] ? descriptors[1] :
      variance < thresholds[2] ? descriptors[2] :
        variance < thresholds[3] ? descriptors[3] : descriptors[4]

}

function correllation(series: Line): number {

  const xArray: Array<number> = [];
  const yArray: Array<number> = [];
  for (let i = 0; i < series.points.length; i++) {
    xArray.push(series.points[i]["x"]);
    yArray.push(series.points[i]["y"]);
  }
  return sampleCorrelation(xArray, yArray);
}

function trendLine(series: Line): TrendLineStats {
  const data = series;
  const dataArray: Array<Array<number>> = [];
  for (let i = 0; i < data.points.length; i++) {
    dataArray.push([data.points[i]["x"], data.points[i]["y"]]);
  }
  let linReg = linearRegression(dataArray);
  const corr = correllation(series);
  return { slope: linReg.m, intercept: linReg.b, correllation: corr };
}

function computeSegments(series: Line, stats: SeriesStats): SegmentInfo[] {
  return series.slice(0, -1).points.map((p, i) => ({
    i,
    direction: Math.sign(slope(p, series.points[i + 1])) || 0, // convert any -0 to +0
    magnitude: magnitude(series, i, i + 2, stats),
    area: segArea(series, i)
  }));
}

function computeRuns(series: Line, stats: SeriesStats, segs: SegmentInfo[]): RunInfo[] {
  const runs: Partial<RunInfo>[] = [{ start: 0, direction: segs[0].direction }];
  let last = runs[0];
  for (let i = 1; i < segs.length; i++) {
    const curDir = segs[i].direction;
    if (curDir !== last.direction) {
      last.end = i + 1;
      last.magnitude = magnitude(series, last.start!, last.end!, stats);
      last.variance = variance(series, last.start!, last.end!, stats);
      last.area = segs.slice(last.start!, last.end! - 1).reduce((sum, s) => sum + s.area, 0);
      last = { start: i, direction: curDir };
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
export class SeriesAnalyzer {
  private bd: Breakdancer;
  //private mex: MessageExtractor;

  constructor() {
    this.bd = new Breakdancer();
    //this.mex = new MessageExtractor();
  }

  /**
   * Perform all analysis of a time series.
   * @param series - Time series
   * @param opts - Options (optional)
   * @returns Results of the series analysis
   * @remarks
   * The message determination machine learning analysis performed by this 
   * method is now offloaded to a worker thread, so the result can be usefully 
   * obtained asynchronously via a `.then()` callback on the returned promise.
   */
  async analyzeSeries(series: Line, opts?: SeriesAnalysisOpts): Promise<SeriesAnalysis> {
    const stats = computeStats(series);
    const segments = computeSegments(series, stats);
    const runs = computeRuns(series, stats, segments);
    const getMessage = async (data: Line) => {
      //const seqBounds = this.bd.getSequences(data, yAxis);
      const { bestSeqs, bestSlopes } = this.bd.getSequences(data, { ...opts });
      //maybeAddSeq(data, seqBounds.bestSeqs);
      //console.log("bestSlopes", bestSlopes)
      //const { candidates, slopeInfo } = genCandidates(
      // data, bestSeqs,
      // opts?.candStableAngleCutoff, opts?.cm2Compat ? 10 : undefined, yAxis);
      const slopeInfo = bestSlopes
      //const msg = await this.mex.chooseMessage(data, candidates, yAxis, opts?.useWorker);
      return { bestSeqs, slopeInfo };
    };
    const { bestSeqs, slopeInfo } = await getMessage(series);
    //const messageCat = msg ? msg.cand.category : null;
    const sequences: Partial<SequenceInfo>[] = bestSeqs.map((seq, i) => ({
      start: seq.start,
      end: seq.end,
      slopeInfo: slopeInfo[i],
      magnitude: magnitude(series, seq.start, seq.end, stats),
      variance: variance(series, seq.start, seq.end, stats),
      area: segments.slice(seq.start, seq.end - 1).reduce((sum, s) => sum + s.area, 0)
    }));
    for (const seqInfo of sequences) {
      const ys = series.slice(seqInfo.start, seqInfo.end).points.map(p => p.y);
      const minYs = min(ys);
      const maxYs = max(ys);
      const { bestSeqs: bestSubSeqs, bestSlopes: bestSubSlopes } = this.bd.getSequences(series.slice(seqInfo.start, seqInfo.end),
        { ...opts, yAxis: { start: minYs, end: maxYs }, maxError: .1, maxSegments: 3 });
      seqInfo.subSequenceInfo = bestSubSeqs.map((seq, i) => ({
        start: seq.start + seqInfo.start!,
        end: seq.end + seqInfo.start!,
        slopeInfo: bestSubSlopes[i],
        magnitude: magnitude(series, seq.start, seq.end, stats),
        variance: variance(series, seq.start, seq.end, stats),
        area: segments.slice(seq.start, seq.end - 1).reduce((sum, s) => sum + s.area, 0)
      }));
    }
    /*
    if (sequences.length === 1) {
      sequences[0].message = messageCat;
      sequences[0].messageStart = msg ? 0 : null;
      sequences[0].messageEnd = msg ? series.length : null;
    } else {
      for (const seqInfo of sequences) {
        const {msg: seqMsg} = await getMessage(series.slice(seqInfo.start, seqInfo.end), opts?.yAxis);
        if (seqMsg) {
          seqInfo.message = seqMsg.cand.category;
          seqInfo.messageStart = seqInfo.start! + seqMsg.cand.params[0];
          seqInfo.messageEnd = seqInfo.start! + seqMsg.cand.params.at(-1)!;
        } else {
          seqInfo.message = null;
          seqInfo.messageStart = null;
          seqInfo.messageEnd = null;
        }
      }
    }
    let messageSeqs: number[] = [];
    if (msg) {
      // Series data indices of start points of seqs in message
      const seqStarts = msg.cand.params.slice(0, -1);
      // Indices of seqs that are included in the message
      messageSeqs = Array.from(sequences.keys()).filter(
        i => seqStarts.includes(sequences[i].start));
    }
        */
    return {
      stats,
      variance: variance(series, 0, series.length, stats),
      correllation: correllation(series),
      area: segments.reduce((sum, s) => sum + s.area, 0),
      // message: messageCat,
      // messageSeqs, // will be [] if message === null
      segments,
      runs,
      sequences: sequences as SequenceInfo[],
    };
  }

}

