import { type Interval, Line, slopeToAngle } from "./chart-classifier-utils";

const DEFAULT_PIP_CLOSENESS = 0.2;



//const NO_MOE_STABLE_ANGLE_CUTOFF = 10; // degrees
const MOE_MIN_POINTS = 6;
// Default value for genCandidates(..., stableAngleCutoff, ...)
const MAX_STABLE_ANGLE = 10; // degrees

// Default value for maximum allowable error during first pass
const MAX_ERROR = .2;
// Default value for maximum total segments used during second pass
const MAX_SEGMENTS = 4;
//Multiplied to the error costs. A number higher than one will favor putting linebreaks on points that are local extremum,
// i.e. peaks or valleys.
const EXTREMUM_WEIGHT = 10;

// Max size (as % of chart) a potential extra final sequence can be
const EXTRA_SEQ_MAX_CHART_PCT = 0.15;

interface Model {
  //svm: SVM;
  //stats: FeatStats;
}

export interface SlopeInfo {
  /**
   * Classes are: 0=stable, 1=rising, -1=falling
   * A maximum of two classes may be present, and if there are two,
   * one of them must be 0 (stable), and the other must not.
   */
  classes: SlopeClass[];
  slope: number;
  angle: number;
  moe?: number;
}

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

type SlopeClass = -1 | 0 | 1;


/**
 * Convert a list of trend sequence intervals of a series
 * (as returned by getSequences()) into an ordered list of 
 * break point indices (not including series end points).
 * @param seqs - List of pairs of sequence end point indices.
 * @returns List of break point indices.
 * @public
 */
export function sequencesToBreaks(seqs: Interval[]): number[] {
  return seqs.map(seq => seq.start).slice(1);
}

/**
 * Convert a list of series break indices into trend sequence intervals. 
 * @param series - Series data points. 
 * @param breaks - List of break point indices.
 * @returns List of trend sequence intervals. 
 * @public
 */
export function breaksToSequences(series: Line, breaks: number[]): Interval[] {
  const breaksWithEndPoints = [0, ...breaks, series.length - 1];
  const seqs: Interval[] = [];
  for (let i = 1; i < breaksWithEndPoints.length; i++) {
    seqs.push({ start: breaksWithEndPoints[i - 1], end: breaksWithEndPoints[i] + 1 });
  }
  return seqs;
}

/**
 * Get the index of the point at which a sequence should be split.
 * @param seq - The sequence of points to be split.
 * @param chartNumPoints - Total number of points in a single series from the source line chart.
 * @param pipCloseness - Max distance (as % of chart length) a sequence-local 
 * min/max point can be from the PIP to be a possible split point.
 * @returns Split point index.
 * @public
 */
export function findSplitIndex(seq: Line, chartNumPoints: number, pipCloseness = DEFAULT_PIP_CLOSENESS): number {
  if (seq.length === 3) {
    // just return the middle point
    return 1;
  }
  const xDiff = seq.points.at(-1)!.x - seq.points[0].x;
  const yDiff = seq.points.at(-1)!.y - seq.points[0].y;
  const m = yDiff / xDiff;
  // theta is congruent to the angle between the perpendicular and
  // the "residual" 
  const theta = Math.atan(m);
  // cos(theta) will always be >0, <=1
  const cosTheta = Math.cos(theta);
  const ys = seq.points.map(p => p.y);
  const inner = seq.slice(1, seq.length - 1);
  // iMin will never equal iMax, since we never get 
  // called on a perfect horizontal line;
  // iMin and iMax are transformed into indices relative to 'inner'
  let iMin: number | null = ys.indexOf(Math.min(...ys)) - 1;
  if (iMin < 0 || iMin === inner.length) {
    iMin = null;
  }
  let iMax: number | null = ys.indexOf(Math.max(...ys)) - 1;
  if (iMax < 0 || iMax === inner.length) {
    iMax = null;
  }
  // We only split on non-endpoints
  const dvs: number[] = [];
  const dps = inner.points.map(p => {
    const dx = p.x - seq.points[0].x;
    const absr = Math.abs(p.y - (m * dx + seq.points[0].y));
    dvs.push(absr);
    return absr * cosTheta;
  });
  const iPip = dps.indexOf(Math.max(...dps));
  let useMin = false;
  if (iMin !== null && Math.abs(iMin - iPip) / (chartNumPoints - 1) <= pipCloseness) {
    useMin = dvs[iMin] > dps[iPip];
  }
  let useMax = false;
  if (iMax !== null && Math.abs(iMax - iPip) / (chartNumPoints - 1) <= pipCloseness) {
    useMax = dvs[iMax] > dps[iPip];
  }
  if (useMax) {
    // If both useMax and useMin are true, go with the max
    return iMax! + 1;
  } else if (useMin) {
    return iMin! + 1;
  } else {
    return iPip + 1;
  }
}


/**
 * Use models trained by breakdancer-trainer to break a line into
 * a sequence of trend sequences.
 * @public
 */
export class Breakdancer {

  //private models: { small: Model, big: Model };


  /**
   * @param model - (Optional) ID of split model to use.
   */
  constructor(model: string | undefined = undefined) {
    /*
    const modelData = getModel(model);
    if (modelData) {
      this.models = {
        small: {
          svm: new SVM(),
          stats: modelData.small.stats
        },
        big: {
          svm: new SVM(),
          stats: modelData.big.stats
        }
      };
    } else {
      throw new Error(`unknown model ID: '${model}'`);
    }
    this.models.small.svm.fromJSON(modelData.small.model);
    this.models.big.svm.fromJSON(modelData.big.model);
    */
  }

  /**
   * Predict whether a sequence should be split.
   * @param seq - Data points of sequence to evaluate. 
   * @param chartLength - Number of data points in the complete chart
   * of which 'seq' is a part.
   * @returns Whether the sequence should be split.
   */
  /*
  private shouldSplit(seq: Line, chartLength: number) {
    if (seq.length < 3 || seq.points.every(p => p.y === seq.points[0].y)) {
      // don't split a seq of only 2 points or a perfect horizontal line
      return false;
    }
    const sfm = new SegmentationFeatureMatrix();
    const model = seq.length < 6 ? 'small' : 'big';
    const [feats] = sfm.computeMatrix(
      [{ data: seq, chartLength }], this.models[model].stats);
    const [pred] = this.models[model].svm.predict([feats]);
    return pred === 1;
  }
*/
  /**
   * Predict trend sequences a series should be split into.
   * @param series - Data points of series to split.
   * @param yAxis - Displayed chart y-axis bounds; defaults to extreme values of data
   * @param pipCloseness - Max distance (as % of chart length) a sequence-local 
   * min/max point can be from the PIP to be a possible split point.
   * @returns List of index pairs denoting the start and end of each sequence.
   * @remarks
   * As in slices, the end index in a pair is not included in the set of indices
   * included in a sequence.
   * NB: Adjacent sequences share the point where they were split.
   * E.g., a hypothetical set of sequences might look like:
   *   [\{start: 0, end: 5\}, \{start: 4, end: 7\}, \{start: 6, end: 10\}]
   * where the first two sequences share the point at index 4, and the last
   * two share the point at index 6.
   */
  /*
  getSequencesOLD(series: Line, yAxis?: Interval, pipCloseness?: number): Interval[] {
    const start = 0;
    const end = series.length;
    // NB: If a sub-section of a complete series is passed in as `series` here,
    // as is done in series-analyzer, the x-value range of the sub-section
    // will be used for the projection, not the x-range of the series as a whole.
    series = series.project(undefined, yAxis);
    const seqs: Interval[] = [];

    const recurse = (i1: number, i2: number) => {
      const seq = series.slice(i1, i2);
      if (this.shouldSplit(seq, series.length)) {
        // Find the split index that the two new seqs will be split between
        const sidx = findSplitIndex(seq, series.length, pipCloseness) + i1;
        // per Wu, the split point is included in both new sequences
        recurse(i1, sidx + 1);
        recurse(sidx, i2);
      } else {
        seqs.push({ start: i1, end: i2 });
      }
    };

    recurse(start, end);
    return seqs;
  }
*/
  /**
 * Predict trend sequences a series should be split into.
 * @param series - Data points of series to split.
 * @param yAxis - Displayed chart y-axis bounds; defaults to extreme values of data
 * @param maxError - Maximum allowable error that would result from the merging of
 * two adjacent segments.
 * @returns List of index pairs denoting the start and end of each sequence.
 * @remarks
 * As in slices, the end index in a pair is not included in the set of indices
 * included in a sequence.
 * NB: Adjacent sequences share the point where they were split.
 * E.g., a hypothetical set of sequences might look like:
 *   [\{start: 0, end: 5\}, \{start: 4, end: 7\}, \{start: 6, end: 10\}]
 * where the first two sequences share the point at index 4, and the last
 * two share the point at index 6.
 */
  getSequences(series: Line, options: SeriesAnalysisOpts) {
    {
      const maxError = options.maxError ?? MAX_ERROR;
      const maxSegments = options.maxSegments ?? MAX_SEGMENTS;
      const extremumWeight = options.extremumWeight ?? EXTREMUM_WEIGHT;
      const seqs: Interval[] = [];
      const orderedIndices: number[] = [];
      const bestSeqs: Interval[] = [];
      const bestSlopes: SlopeInfo[] = [];
      const segments: Line[] = []
      const costArray: number[] = []
      series = series.project(undefined, options.yAxis)
      for (let i = 0; i < series.length - 1; i++) {
        segments.push(new Line([...series.points.slice(i, i + 2)]))
      }

      for (let i = 0; i < segments.length - 1; i++) {
        costArray[i] = this.euclidCost(merge(segments[i], segments[i + 1]), extremumWeight, segments[i], segments[i + 1])
      }
      function merge(line1: Line, line2: Line): Line {
        return new Line([...line1.points, ...line2.points.toSpliced(0, 1)])
      }

      let i = 0
      while (Math.min(...costArray) < maxError) {
        const minIndex = costArray.indexOf(Math.min(...costArray))
        orderedIndices.push(minIndex);
        segments[minIndex] = merge(segments[minIndex], segments[minIndex + 1])
        segments.splice(minIndex + 1, 1)
        if (segments[minIndex - 1]) {
          costArray[minIndex - 1] = this.euclidCost(merge(segments[minIndex - 1], segments[minIndex]), extremumWeight, segments[minIndex - 1], segments[minIndex])
        }
        costArray.splice(minIndex, 1)
        if (segments[minIndex + 1]) {
          costArray[minIndex] = this.euclidCost(merge(segments[minIndex], segments[minIndex + 1]), extremumWeight, segments[minIndex], segments[minIndex + 1])
        }

        i++
      }
      //After initial breaking is done, goes back through and attempts to shift line breaks left or right in an attempt to further reduce error.
      //This works but didn't produce the results I wanted, it might still be useful in the future though.
      /*
      i = 0;
      while(i < 2){
        let runningIndex = 0;
        for (let j = 0; j < segments.length - 1; j++){
          const stayCost = this.euclidCost(series, segments[j]) + this.euclidCost(series, segments[j + 1])
          let leftChangeCost = 100;
          let rightChangeCost = 100;
          if (segments[j].points.length > 2){
            let leftSegment1 = new Line([...series.points.slice(runningIndex, runningIndex + segments[j].points.length - 1)])
            let leftSegment2 = merge(new Line([...series.points.slice(runningIndex + segments[j].points.length - 2, runningIndex + segments[j].points.length)]), segments[j + 1])
            leftChangeCost = 2 * (this.euclidCost(series, leftSegment1) + this.euclidCost(series, leftSegment2))
          }
   
          if (segments[j + 1].points.length > 2){
            let rightSegment1 = merge(segments[j], new Line([...series.points.slice(runningIndex + segments[j].points.length - 1, runningIndex + segments[j].points.length + 1)]))
            let rightSegment2 = new Line([...series.points.slice(runningIndex + segments[j].points.length, runningIndex + segments[j].points.length + segments[j + 1].points.length - 1)])
            rightChangeCost = 2 * (this.euclidCost(series, rightSegment1) + this.euclidCost(series, rightSegment2))
          }
          if (leftChangeCost < stayCost || rightChangeCost < stayCost){
          }
          runningIndex += segments[j].points.length - 1
        }
        i++
      }
        */

      for (let segment of segments) {
        seqs.push({ start: series.points.indexOf(segment.points[0]), end: series.points.indexOf(segment.points[segment.points.length - 1]) + 1 })
      }

      if (seqs.length > maxSegments) {
        while (segments.length > maxSegments) {
          const minIndex = costArray.indexOf(Math.min(...costArray))
          orderedIndices.push(minIndex);
          segments[minIndex] = merge(segments[minIndex], segments[minIndex + 1])
          segments.splice(minIndex + 1, 1)
          if (segments[minIndex - 1]) {
            costArray[minIndex - 1] = this.euclidCost(merge(segments[minIndex - 1], segments[minIndex]), extremumWeight, segments[minIndex - 1], segments[minIndex])
          }
          costArray.splice(minIndex, 1)
          if (segments[minIndex + 1]) {
            costArray[minIndex] = this.euclidCost(merge(segments[minIndex], segments[minIndex + 1]), extremumWeight, segments[minIndex], segments[minIndex + 1])
          }
          i++
        }
      }
      for (let segment of segments) {
        const slope = this.classifySlope(segment)
        bestSlopes.push(slope);
        bestSeqs.push({ start: series.points.indexOf(segment.points[0]), end: series.points.indexOf(segment.points[segment.points.length - 1]) + 1 })
      }
      return { originalSeqs: seqs, bestSeqs: bestSeqs, bestSlopes: bestSlopes, orderedIndices: orderedIndices }
    }
  }

  euclidCost(seq1: Line, extremumWeight: number, component1?: Line, component2?: Line) {
    const segment = seq1.points
    const last = segment.length - 1
    const yStart = segment[0].y
    const yEnd = segment[segment.length - 1].y
    const squaredResid = (x: number, y: number) => (y - (yStart + (yEnd - yStart) * (x - segment[0].x) / (segment[last].x - segment[0].x))) ** 2
    let sum = 0;
    for (let i = 1; i < segment.length; i++) {
      sum += squaredResid(segment[i].x, segment[i].y)
    }
    if (component1 && component2) {
      if (!((component1.points[component1.points.length - 1].y - component1.points[component1.points.length - 2].y) * (component2.points[0].y - component2.points[1].y) >= 0)) {
        sum /= extremumWeight
      }
    }
    return sum
  }

  /**
 * Classify the slope of a trend sequence as rising, falling, or stable.
 * @remarks
 * If the slope classification is ambiguous, it may have class stable
 * along with one of the other two classes.
 * If the sequence consists of only two points, the class will be 
 * computed simply from the angle with the x-axis, and any angle
 * \< stableAngleCutoff is taken as stable.
 * If the sequence consists of 3, 4, or 5 points, the class is computed
 * as above, but the slope value is taken from the regression line.
 * Otherwise, a confidence interval is computed as per Wu. If the
 * confidence interval signs don't match, the sequence is assigned
 * the stable class, but may also be assigned rising or falling
 * if the angle is \>= stableAngleCutoff. Similarly, if 
 * the confidence interval signs do match but the angle is 
 * \< stableAngleCutoff, multiple classes will be assigned.
 * @param seq - Sequence data points
 * @param stableAngleCutoff - Optional max angle (in degrees) for stable classification
 * @param noMoeCutoff - stableAngleCutoff for sequences of less than MOE_MIN_POINTS;
 * for compatibility with Chartmob 2 data
 * @public
 */
  classifySlope(seq: Line, stableAngleCutoff = MAX_STABLE_ANGLE, noMoeCutoff = stableAngleCutoff): SlopeInfo {
    let slope = (seq.points[seq.points.length - 1].y - seq.points[0].y) / (seq.points[seq.points.length - 1].x - seq.points[0].x);
    let angle = slopeToAngle(slope)
    // See https://stattrek.com/regression/slope-confidence-interval
    // Also: https://en.wikipedia.org/wiki/Simple_linear_regression
    const n = seq.length;
    if (n < 3) {
      // Don't do regression if there are only 2 data points.
      const theta = slopeToAngle(slope);
      if (Math.abs(theta) < noMoeCutoff) {
        slope = 0;
      }
      return { classes: [this.slopeSign(slope)], slope, angle: theta };
    } else {
      const rss = seq.bestFit.rss();
      if (n < MOE_MIN_POINTS) {
        let cls = this.slopeSign(slope);
        if (Math.abs(angle) < noMoeCutoff) {
          cls = 0;
        }
        return { classes: [cls], slope: slope, angle: angle };
      }
      const xs = seq.points.map(p => p.x);
      // sample std dev
      const regSe = Math.sqrt(rss / (n - 2));

      // standard error of linear regression slope
      const se = regSe / this.norm(xs);

      const alpha = 0.05;
      const pStar = 1 - alpha / 2;
      const tDist = new TDistribution(n - 2);
      // t depends only on n, and gets smaller as n increases
      const t = tDist.invCumulativeProbability(pStar, n - 2);
      const moe = t * se;
      //if (n === MOE_MIN_POINTS) {
      //  console.log('ys', ys, 'regYs', regYs, 'regSe', regSe, 'norm', norm(xs), 'se', se, 't', t, 'moe', moe);
      //}
      const confInt = [slope - moe, slope + moe];
      const classes: SlopeClass[] = [];
      if (Math.sign(confInt[0]) !== Math.sign(confInt[1])) {
        classes.push(0);
        if (Math.abs(angle) >= stableAngleCutoff) {
          classes.pop();
          classes.push(this.slopeSign(slope));
        }
      } else {
        classes.push(this.slopeSign(slope));
        // NB: If slope == 0, don't push 0 again
        if (Math.abs(angle) < stableAngleCutoff && slope) {
          classes.push(0);
        }
      }
      return { classes, slope: slope, angle: angle, moe };
    }
  }

  slopeSign(slope: number): SlopeClass {
    return Math.sign(slope) as SlopeClass;
  }

  /**
   * Compute the norm of a set of data.
   */
  norm(data: number[]) {
    const mean = data.reduce((sum, val) => sum + val, 0) / data.length;
    const deviations = data.map(x => x - mean);
    const norm = Math.sqrt(deviations.reduce((sum, x) => sum + x ** 2, 0));
    return norm;
  }
}


export class TDistribution {
  df: number = 1;
  constructor(df: number) {
    if (df) {
      this.df = df;
    }
  }

  LogGamma(Z: number) {
    const S = 1 + 76.18009173 / Z - 86.50532033 / (Z + 1) + 24.01409822 / (Z + 2)
      - 1.231739516 / (Z + 3) + .00120858003 / (Z + 4) - .00000536382 / (Z + 5);
    const LG = (Z - .5) * Math.log(Z + 4.5) - (Z + 4.5) + Math.log(S * 2.50662827465);
    return LG;
  }

  Betinc(X: number, A: number, B: number) {
    let A0 = 0;
    let B0 = 1;
    let A1 = 1;
    let B1 = 1;
    let M9 = 0;
    let A2 = 0;
    let C9;
    while (Math.abs((A1 - A2) / A1) > .00001) {
      A2 = A1;
      C9 = -(A + M9) * (A + B + M9) * X / (A + 2 * M9) / (A + 2 * M9 + 1);
      A0 = A1 + C9 * A0;
      B0 = B1 + C9 * B0;
      M9 = M9 + 1;
      C9 = M9 * (B - M9) * X / (A + 2 * M9 - 1) / (A + 2 * M9);
      A1 = A0 + C9 * A1;
      B1 = B0 + C9 * B1;
      A0 = A0 / B1;
      B0 = B0 / B1;
      A1 = A1 / B1;
      B1 = 1;
    }
    return A1 / A;
  }

  cumulativeProbability(X: number, df?: number) {
    if (!df) {
      df = this.df;
    }
    let tcdf = 0;
    if (df <= 0) {
      console.error("Degrees of freedom must be positive");
    } else {
      const A = df / 2;
      const S = A + .5;
      const Z = df / (df + X * X);
      const BT = Math.exp(this.LogGamma(S) - this.LogGamma(.5) -
        this.LogGamma(A) + A * Math.log(Z) + .5 * Math.log(1 - Z));
      let betacdf;
      if (Z < (A + 1) / (S + 2)) {
        betacdf = BT * this.Betinc(Z, A, .5);
      } else {
        betacdf = 1 - BT * this.Betinc(1 - Z, .5, A);
      }
      if (X < 0) {
        tcdf = betacdf / 2;
      } else {
        tcdf = 1 - betacdf / 2;
      }
    }
    tcdf = Math.round(tcdf * 100000) / 100000;
    return tcdf;
  }

  invCumulativeProbability(p: number, df: number) {
    if (!df) {
      df = this.df;
    }
    const delta = 0.005;

    if (p >= 0.5) {
      let Z1 = 0;
      for (let Z = 0; Z < 100; Z++) {
        if (this.cumulativeProbability(Z, df) >= p) {
          break;
        }
        Z1 = Z;
      }
      let Z2 = Z1;
      for (let Z = 0.0; Z < 100.0; Z += 1.0) {
        if (this.cumulativeProbability(Z1 + Z / 100.0) >= p) {
          break;
        }
        Z2 = Z1 + (Z) / 100.0;
      }
      let Z3 = Z2;
      for (let Z = 0.0; Z < 100.0; Z += 1.0) {
        if (this.cumulativeProbability(Z2 + Z / 10000.0) >= p) {
          break;
        }
        Z3 = Z2 + (Z) / 10000.0;
      }
      return Z3;
    } else {
      let Z1 = 0;
      for (let Z = 0; Z < 100; Z++) {
        if (this.cumulativeProbability(-Z, df) <= p) {
          break;
        }
        Z1 = Z;
      }
      let Z2 = Z1;
      for (let Z = 0.0; Z < 100.0; Z += 1.0) {
        if (this.cumulativeProbability(-Z1 - Z / 100.0) <= p) {
          break;
        }
        Z2 = Z1 + (Z) / 100.0;
      }
      let Z3 = Z2;
      for (let Z = 0.0; Z < 100.0; Z += 1.0) {
        if (this.cumulativeProbability(-Z2 - Z / 10000.0) <= p) {
          break;
        }
        Z3 = Z2 + (Z) / 10000.0;
      }
      return -Z3;
    }
  }
}