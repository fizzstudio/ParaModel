/* ParaModel: Series Pair Analysis Interfaces
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

// Types 

/**
 * The two lines which intersect
 */
export type SeriesPair = [string, string];

/**
 * An angle between two line segments or subsegments which meet at a point
 */
export interface Angle {
  /**
   * The first meeting line
   */
  [k: string]: {
    [k: string]: AngleDetails;
  };
}

/**
 * The second meeting line
 */
export interface AngleDetails {
  /**
   * The meeting line which is higher
   */
  top: string;
  /**
   * The size of the angle between the meeting lines in degrees
   */
  angle: number;
  /**
   * The gradients of the two meeting lines
   */
  slope: {
    /**
     * The gradients of the two meeting lines. Each property name is one of the keys of the intersecting lines.
     */
    [k: string]: number;
  };
}

export type TransverseCross = {
  kind: 'cross',
  topToBottom: string,
  bottomToTop: string
}

export type TransverseTouchEdge = {
  kind: 'touch' | 'edge',
  top: string,
  bottom: string
}

/**
 * Whether the intersecting lines cross or touch, and which line is on top of the other.
 */
export type Transverse = TransverseCross | TransverseTouchEdge;

/**
 * The metadata for an intersection of two lines
 */
export interface Intersection {
  /**
   * Where the intersection occurs
   */
  record: {
    /**
     * The (x-)label where the intersection occurs, if it occurs exactly on an (x-)label, and otherwise null
     */
    label: string | null;
    /**
     * The closest (x-)label before the intersection, if it occurs between two (x-)labels, and otherwise null
     */
    before: string | null;
    /**
     * The closest (x-)label after the intersection, if it occurs between two (x-)labels, and otherwise null
     */
    after: string | null;
  };
  /**
   * The y-value of the intersection
   */
  value: number;
  series: SeriesPair;
  /**
   * The angle between the intersecting lines as they come into the intersection, or null if the intersection is at the start of the graph.
   */
  incomingAngle: null | Angle;
  /**
   * The angle between the intersecting lines as they leave the intersection, or null if the intersection is at the end of the graph.
   */
  outgoingAngle: null | Angle;
  transversality: Transverse;
}

/**
 * An (x,y) datapoint, where x is a label string and y is a number.
 */
export type DatapointStringNumber = [string, number];

/**
 * The metadata for an overlap of lines
 */
export interface Overlap {
  /**
   * The (x,y) datapoints where the overlap occurs. Note that an overlap can only start/end on a record.
   *
   * @minItems 2
   */
  datapoints: DatapointStringNumber[];
  series: SeriesPair;
  /**
   * The angle between the lines before they start overlapping, or null if the overlap is at the start of the chart.
   */
  incomingAngle: null | Angle;
  /**
   * The angle between the lines after they finish overlapping, or null if the overlap is at the end of the chart.
   */
  outgoingAngle: null | Angle;
}

/**
 * The metadata for a portion of two lines which parallel
 */
export interface Parallel {
  /**
   * The x-labels where the parallel occurs. Note that an parallel can only start/end on a x-label.
   *
   * @minItems 2
   */
  records: {
    /**
     * A label on the independent (normally x-)axis, as a non-empty string. This is identical to `name`, but specified for semantic reasons
     */
    label: string;
  }[];
  series: SeriesPair;
  /**
   * The direction of the parallel lines as they come to parallel, or null if the parallel starts at the start of the graph.
   */
  incomingDirection: "converge" | "diverge" | null;
  /**
   * The direction of the parallel lines as they finish parallelling, or null if the parallel ends at the end of the graph.
   */
  outgoingDirection: "converge" | "diverge" | null;
  /**
   * Whether the parallel lines are perfectly parallel, or only functionally parallel.
   */
  kind: "perfect" | "functional";
}

/**
 * Additional metadata on the relationship between a pair of lines on the chart
 */
export interface Pair {
  series: SeriesPair;
  /**
   * Which of the lines is on top for most of the graph, or null if they are equally dominant.
   */
  dominant: string | null;
  /**
   * The percentage of the course of the dominant line where it is on top of the other line. If the lines are equally dominant, this has the value 50%.
   */
  dominantPercent: number;
  /**
   * The percentage of the course of the lines where they are (functionally or perfectly) parallel.
   */
  parallelPercent: number;
}

/**
 * The x-value interval that this group covers.
 */
export type Interval = [string, string];

/**
 * An (x,y) datapoint, where x is a number and y is a number.
 */
export type DatapointNumberNumber = [number, number];

/**
 * The line formed by averaging every line in this group. This field is made up of an array of (x,y) pairs, where for each x-label within the interval of this group, the y-value is equal to the average of the y-values of the lines of this group at that x-label.
 *
 * @minItems 2
 */
export type SeriesDatapoints = DatapointNumberNumber[];

/**
 * A group of lines which track each other across an interval of the chart
 */
export interface TrackingGroup {
  /**
   * The keys of the series which make up this group.
   *
   * @minItems 2
   */
  keys: string[];
  /**
   * The keys of the series which are not in this group, if any.
   */
  outliers: string[];
  interval: Interval;
  averageLine: SeriesDatapoints;
}

/**
 * A member of the partition of the chart into one or more x-label intervals where every boundary of a tracking group forms the boundary of a zone.
 */
export interface TrackingZone {
  /**
   * A group of lines which track each other across this zone.
   *
   * @minItems 1
   */
  groups: TrackingGroup[];
  interval: Interval;
}

// Analyzer

export interface SeriesPairMetadataAnalyzer {
  getIntersections(): Intersection[];
  getOverlaps(): Overlap[];
  getParallels(): Parallel[];
  getPairs(): Pair[];
  getTrackingGroups(): TrackingGroup[];
  getTrackingZones(): TrackingZone[];
  getClusters(): string[][];
  getClusterOutliers(): string[];
}