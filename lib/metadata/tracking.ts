/* ParaModel: AI-enhanced Series Tracking Analysis
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

import { Line, type Interval, mapn } from '@fizz/chart-classifier-utils';
import { LineIntersectionDetection } from './basic_pair_analyzer';

/**
 * An x-value interval on a chart and an associated pair of lines that
 * track each other during the interval. 
 */
interface TrackingPair {
  keyPair: [string, string];
  interval: Interval;
}

function setEq<T>(s1: Set<T>, s2: Set<T>): boolean {
  if (s1.size !== s2.size) {
    return false;
  }
  return Array.from(s1).every(t => s2.has(t));
}

/**
 * Generate all possible pairs from items in a list.
 */
function getPairs<T>(items: T[]): [T, T][] {
  //   0 1 2 3
  // 0 - y y y
  // 1 n - y y
  // 2 n n - y
  // 3 n n n -
  const pairs: [T, T][] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      pairs.push([items[i], items[j]]);
    }
  }
  return pairs;
}

function mergeIntervals(inter1: Interval, inter2: Interval): Interval {
  return {
    start: Math.min(inter1.start, inter2.start),
    end: Math.max(inter1.end, inter2.end)
  }
}

function intervalEq(inter1: Interval, inter2: Interval) {
  return inter1.start === inter2.start && inter1.end === inter2.end;
}

/**
 * NB: Also detects immediate adjacency
 */
function isIntervalsOverlap(inter1: Interval, inter2: Interval) {
  return (
    inter1.start >= inter2.start &&
    inter1.start <= inter2.end) || (
    inter2.start >= inter1.start &&
    inter2.start <= inter2.end)
}

/**
 * Convert x-value breaks into x-value intervals.
 * Unlike breakdancer.breaksToSequences(), this function consumes breaks
 * that are actual x-values, not record indices. The intervals returned
 * are also x-value intervals, with 'start' and 'end' properties corresponding
 * to the actual interval start and end x-values (i.e., not like slices).
 */
function breaksToIntervals(series: Line, breaks: number[]): Interval[] {
  const breaksWithEndPoints = [series.points[0].x, ...breaks, series.points.at(-1)!.x];
  const seqs: Interval[] = [];
  for (let i = 1; i < breaksWithEndPoints.length; i++) {
    seqs.push({start: breaksWithEndPoints[i - 1], end: breaksWithEndPoints[i]});
  }
  return seqs;
}

/**
 * An x-value interval on a chart and an associated set of lines that
 * track each other during the interval. 
 * @public
 * @remarks
 * In actuality, the 'tracking' relation between two series is not
 * transitive: tracking(A,B) and tracking(B,C) does not imply tracking(A,C).
 * However, when tracking groups are created, we "pretend" that the relation
 * is in fact transitive. This allows for a slightly looser definition of
 * tracking (which is still affected by the closeness parameter), and 
 * simplifies the set of tracking groups presented to the user.
 */
export class TrackingGroupBuilder {

  /**
   * Do not use; call TrackingGroup.getGroups() to create tracking groups.
   * @internal
   */
  constructor(public keys: Set<string>, public interval: Interval, public seriesByKey: Map<string, Line>) {
  }

  /**
   * Compute tracking groups for the set of series of a chart.
   * @param allSeries - All series of a chart.
   * @param minSize - Value between 0 and 1 determining the minimum size of a 
   * tracking group (as a percentage of chart width).
   * @param closeness - Value between 0 and 1 determining the degree of tracking
   * closeness required for lines to pair/group.
   * @returns The tracking groups.
   */
  static getGroups(allSeries: Line[], minSize = 0.25, closeness = 0.9): TrackingGroupBuilder[] {
    const keyMap: Map<string, Line> = new Map();
    allSeries.forEach(line => keyMap.set(line.key!, line));

    const keyPairs: [string, string][] = getPairs(allSeries).map(([line1, line2]) => [line1.key!, line2.key!]);
    let trackingPairs: TrackingPair[] = [];
    const minY = Math.min(...allSeries.map(ln => ln.yBounds().start));
    const maxY = Math.max(...allSeries.map(ln => ln.yBounds().end));
    const yRange = maxY - minY;
    const diffYAxis = {
      start: 0,
      end: yRange
    };
    for (const keyPair of keyPairs) {
      const lid = new LineIntersectionDetection(
        keyMap.get(keyPair[0])!, keyMap.get(keyPair[1])!, 1 / 2);
      const rts = lid.getRelativeTrajectories(diffYAxis);
      // Only keep tracking intervals no smaller than minSize percent of the chart
      const tps: TrackingPair[] = rts
        .filter(rt => 
          rt.type === 'tracking' && 
          rt.interval.end - rt.interval.start >= allSeries[0].xRange()*minSize &&
          rt.degree >= closeness)
        .map(rt => ({ keyPair, interval: rt.interval }));
      trackingPairs = trackingPairs.concat(tps);
    }
    let groups = TrackingGroupBuilder.createGroupsFromPairs(trackingPairs, keyMap);
    groups = TrackingGroupBuilder.normalizeGroups(groups);
    groups.reverse();
    return groups;
  }

  private static createGroupsFromPairs(trackingPairs: TrackingPair[], seriesByKey: Map<string, Line>): TrackingGroupBuilder[] {
    // Collect intervals into a unique set
    const intervals: Interval[] = [];
    function interId(inter: Interval) {
      return intervals.findIndex(i => i.start === inter.start && i.end === inter.end);
    }
    for (const tp of trackingPairs) {
      if (interId(tp.interval) === -1) {
        intervals.push(tp.interval);
      }
    }
    // Maps of intervals to key pairs and individual keys
    const interKeyPairs: Map<number, [string, string][]> = new Map();
    const interKeys: Map<number, string[]> = new Map();
    for (const {keyPair, interval} of trackingPairs) {
      const id = interId(interval);
      let keyPairs = interKeyPairs.get(id);
      if (!keyPairs) {
        keyPairs = [];
        interKeyPairs.set(id, keyPairs);
      }
      keyPairs.push(keyPair);
      let keys = interKeys.get(id);
      if (!keys) {
        keys = [];
        interKeys.set(id, keys);
      }
      for (const key of keyPair) {
        if (!keys.includes(key)) {
          keys.push(key);
        }
      }
    }
  
    const groups: TrackingGroupBuilder[] = [];
  
    // Find the tracking groups for each interval
    for (const [id, keys] of interKeys) {
      const thisInterKeyPairs = interKeyPairs.get(id);
  
      // Pretend tracking is transitive and make sets of tracking lines
      let sets: Set<string>[] = [];
      for (const keyPair of thisInterKeyPairs!) {
        // Look for existing sets containing each item of the pair
        const set0 = sets.find(s => s.has(keyPair[0]));
        const set1 = sets.find(s => s.has(keyPair[1]));
        if (!set0 && !set1) { 
          // No existing sets found
          sets.push(new Set(keyPair));
        } else if (set0 && set1 && set0 !== set1) {
          // Found separate sets for each line; merge them
          set1.forEach(line => set0!.add(line));
          sets = sets.filter(s => s !== set1);
        } else if (set0) {
          set0.add(keyPair[1]);
        } else {
          set1!.add(keyPair[0]);
        }
      }
      for (const keySet of sets) {
        groups.push(new TrackingGroupBuilder(keySet, intervals[id], seriesByKey));
      }
    }
    return groups;
  }
  
  /**
   * Supplement smaller tracking groups contained entirely within larger ones.
   * Line groups are updated in-place.
   * @internal
   */
  static suppleteGroups(groups: TrackingGroupBuilder[]) {
    let didSupplete = false;
    // Sort widest to narrowest
    groups.sort((a, b) => {
      const aSize = a.interval.end - a.interval.start;
      const bSize = b.interval.end - b.interval.start;
      return Math.sign(bSize - aSize);
    });
    for (let i = 0; i < groups.length; i++) {
      const gi = groups[i];
      for (let j = i + 1; j < groups.length; j++) {
        const gj = groups[j];
        if (gi.interval.start > gj.interval.start || gi.interval.end < gj.interval.end) {
          // Make sure gi is either identical to or encloses gj
          continue;
        }
        if (gi.interval.end - gi.interval.start === gj.interval.end - gj.interval.start) {
          const res1 = gi.supplete(gj);
          const res2 = gj.supplete(gi);
          didSupplete ||= res1 || res2;
        } else {
          const res = gi.supplete(gj);
          didSupplete ||= res;
        }
      }
    }
    return didSupplete;
  }

  /**
   * Supplete group 'other' in-place.
   */
  private supplete(other: TrackingGroupBuilder) {
    let didSupplete = false;
    if (Array.from(this.keys).some(key => other.keys.has(key))) {
      for (const key of this.keys) {
        if (!other.keys.has(key)) {
          other.keys.add(key);
          didSupplete = true;
        }
      }
    } 
    return didSupplete;
  }

  /**
   * Create a new array of tracking groups by merging any groups
   * that overlap (or abut) and consist of the same set of lines.
   * @param groups - Original array of tracking groups
   * @returns New array of tracking groups
   * @internal
   */
  static mergeGroups(groups: TrackingGroupBuilder[]): TrackingGroupBuilder[] {
    if (groups.length) {
      let merged: TrackingGroupBuilder[];
      do {
        merged = [];
        const remove: TrackingGroupBuilder[] = [];
        outer:
        for (let i = 0; i < groups.length; i++) {
          const gi = groups[i];
          for (let j = i + 1; j < groups.length; j++) {
            const gj = groups[j];
            if (isIntervalsOverlap(gi.interval, gj.interval) && setEq(gi.keys, gj.keys)) {
              merged.push(new TrackingGroupBuilder(gi.keys, 
                mergeIntervals(gi.interval, gj.interval), gi.seriesByKey));
              remove.push(gi, gj);
              break outer;
            } 
          }
        }
        groups = groups.filter(g => !remove.includes(g)).concat(merged);
      } while (merged.length);
    }
    return groups;
  }

  /**
   * Iteratively supplete and merge a set of tracking groups until
   * we can't supplete any group further.
   * @internal
   */
  static normalizeGroups(groups: TrackingGroupBuilder[]) {
    let didSupplete = TrackingGroupBuilder.suppleteGroups(groups);
    do {
      groups = TrackingGroupBuilder.mergeGroups(groups);
      didSupplete = TrackingGroupBuilder.suppleteGroups(groups);
    } while (didSupplete);
    return groups;
  }

  /**
   * Get series not included in the tracking group.
   * @returns The outlier line keys relative to the group.
   */
  outliers(): string[] {
    return Array.from(this.seriesByKey.keys()).filter(key => !this.keys.has(key)).sort();
  }

  /**
   * Compute the line of averaged values from the lines in the tracking group.
   * @returns The average line.
   */
  averageLine(): Line {
    const sections = Array.from(this.keys).map(key => 
      this.seriesByKey.get(key)!.extractSection(this.interval)!);
    const nseries = sections.length;
    return new Line(mapn(sections[0].length, i => ({
      x: sections[0].points[i].x, 
      y: mapn(nseries, j => sections[j].points[i].y).reduce((a, b) => a + b)/nseries
    })));
  }

}

/**
 * An x-value interval on a chart and an associated set of tracking groups
 * that contain sets of lines that track each other during the interval.
 * Tracking zones may NOT overlap. The tracking group objects they contain
 * are separate from the tracking group objects used to created the zone,
 * and are constrained to the zone's interval. (Full tracking groups are used
 * rather than simply sets of lines mostly to facilitate suppletion and merging.)
 * @public
 */
export class TrackingZoneBuilder {

  /**
   * Do not use; call TrackingZone.getZones() to create tracking zones.
   */
  private constructor(public trackingGroups: TrackingGroupBuilder[], public interval: Interval) { 
  }

  /**
   * Compute tracking zones from a set of tracking groups.
   * @param trackingGroups - Tracking groups of the chart.
   * @returns The list of tracking zones.
   * @public
   */
  static getZones(trackingGroups: TrackingGroupBuilder[]): TrackingZoneBuilder[] {
    const breaks: Set<number> = new Set();
    // get x-value breaks from tracking groups
    trackingGroups.forEach(z => {
      breaks.add(z.interval.start);
      breaks.add(z.interval.end);
    });
    // Remove bookend breaks
    const sortedBreaks = Array.from(breaks).sort().slice(1, -1);

    // Compute non-overlapping intervals.
    // NB: This may contain intervals where no tracking is taking place
    const intervals = breaksToIntervals(
      trackingGroups[0].seriesByKey.values().next().value, sortedBreaks);
    const trackingZones: TrackingZoneBuilder[] = [];
    for (const interval of intervals) {
      let didCreateZone = false;
      for (const g of trackingGroups) {
        if (g.interval.start <= interval.start && g.interval.end >= interval.end) {
          const zone = trackingZones.find(z => intervalEq(interval, z.interval));
          // Create a new tracking group object that can be suppleted if necessary
          const newG: TrackingGroupBuilder = new TrackingGroupBuilder(new Set(g.keys), interval, g.seriesByKey);
          if (!zone) {
            trackingZones.push(new TrackingZoneBuilder([newG], interval));
            didCreateZone = true;
          } else {
            zone.trackingGroups.push(newG);
          }
        }
      }
      if (didCreateZone) {
        const z = trackingZones.at(-1)!;
        z.trackingGroups = TrackingGroupBuilder.normalizeGroups(z.trackingGroups);
      }
    }
    return trackingZones;
  }

}

