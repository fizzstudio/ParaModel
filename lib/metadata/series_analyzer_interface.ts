/* ParaModel: Series Analysis
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
 * Message category
 * @public
 */
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
  volatility: number;
  /** Area under the run */
  area: number;
}

/**
 * @public
 */
export declare interface SlopeInfo {
  /**
   * Classes are: 0=stable, 1=rising, -1=falling
   * A maximum of two classes may be present, and if there are two,
   * one of them must be 0 (stable), and the other must not.
   */
  classes: number[];
  slope: number;
  angle: number;
  moe?: number;
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
  volatility: number;
  /** Area under the sequence */
  area: number;
  /** Sequence message */
  message: Category | null;
  /** Index of start of sequence message in SERIES */
  messageStart: number | null;
  /** Index AFTER last index of sequence message in SERIES (like slices) */
  messageEnd: number | null;
}

export interface SingleSeriesMetadataAnalyzer {
  /** Basic time series statistics */
  getStats(): SeriesStats;
  /** Measure of variability in data */
  getVolatility(): number;
  /** Area under the series */
  getArea(): number;
  /** Message of entire time series */
  getMessage(): Category | null;
  /** Indices of sequences that form the message */
  getMessageSeqs(): number[];
  /** Segment (i.e., adjacent pairs of points) info */
  getSegments(): SegmentInfo[];
  /** Run info */
  getRuns(): RunInfo[];
  /** Sequence info */
  getSequences(): SequenceInfo[];
}