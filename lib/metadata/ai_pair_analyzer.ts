/* ParaModel: AI-enhanced Series Pair Analysis
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

import { Line } from '@fizz/chartsignal-internal';

import { TrackingGroup, TrackingZone } from "./pair_analyzer_interface";
import { SeriesPairMetadataAnalyzer } from "./basic_pair_analyzer";
import { TrackingGroupBuilder, TrackingZoneBuilder } from "./tracking";
import { SpatialClusters } from './clusters';

export class AiSeriesPairMetadataAnalyzer extends SeriesPairMetadataAnalyzer {

  constructor(seriesArray: Line[], screenCoordSysSize: [number, number], yMin?: number, yMax?: number) {
    super(seriesArray, screenCoordSysSize, yMin, yMax);
    const { trackingGroups, convergingGroups, divergingGroups } = TrackingGroupBuilder.getGroups(seriesArray, undefined, 0.90);
    this.trackingGroups = trackingGroups.map((tg) => this.generateTrackingGroupMetadata(tg, "tracking"));
    this.convergingGroups = convergingGroups.map((tg) => this.generateTrackingGroupMetadata(tg, "converging"));
    this.divergingGroups = divergingGroups.map((tg) => this.generateTrackingGroupMetadata(tg, "diverging"));
    if (trackingGroups.length) {
      this.trackingZones = TrackingZoneBuilder.getZones(trackingGroups)
        .map((tz) => this.generateTrackingZoneMetadata(tz));
    }
    const clusters = new SpatialClusters(seriesArray);
    this.clusters = clusters.clusters.map((cluster) => cluster.map((line) => line.key!));
    this.clusterOutliers = clusters.noise.map((line) => line.key!);
  }

  private generateTrackingGroupMetadata(tg: TrackingGroupBuilder, type: "tracking" | "converging" | "diverging"): TrackingGroup {
    return {
      keys: Array.from(tg.keys),
      outliers: tg.outliers(),
      valueInterval: tg.interval,
      averageLine: tg.averageLine().points.map((point) => [point.x, point.y]),
      differentialLines: tg.computeDifferentialLine(tg.keys),
      type: type
    }
  }

  private generateTrackingZoneMetadata(tz: TrackingZoneBuilder): TrackingZone {
    return {
      groups: tz.trackingGroups.map((tg) => this.generateTrackingGroupMetadata(tg, "tracking")),
      valueInterval: [tz.interval.start, tz.interval.end]
    }
  }
  
}