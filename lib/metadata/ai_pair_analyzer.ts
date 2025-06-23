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

import { Line } from "@fizz/chart-classifier-utils";
import { SeriesPairMetadataAnalyzer, TrackingGroup, TrackingZone } from "./pair_analyzer_interface";
import { BasicSeriesPairMetadataAnalyzer } from "./basic_pair_analyzer";
import { TrackingGroupBuilder, TrackingZoneBuilder } from "./tracking";

export class AiSeriesPairMetadataAnalyzer extends BasicSeriesPairMetadataAnalyzer implements SeriesPairMetadataAnalyzer {

  constructor(seriesArray: Line[], screenCoordSysSize: [number, number], yMin?: number, yMax?: number) {
    super(seriesArray, screenCoordSysSize, yMin, yMax);
    const trackingGroups = TrackingGroupBuilder.getGroups(seriesArray, undefined, 0.90);
    this.trackingGroups = trackingGroups.map((tg) => this.generateTrackingGroupMetadata(tg));
    if (trackingGroups.length) {
      this.trackingZones = TrackingZoneBuilder.getZones(trackingGroups)
        .map((tz) => this.generateTrackingZoneMetadata(tz));
    }
    const clusters = new SpatialClusters(seriesArray);
    this.clusters = clusters.clusters.map((cluster) => cluster.map((line) => line.key!));
    this.clusterOutliers = clusters.noise.map((line) => line.key!);
  }

    private generateTrackingGroupMetadata(tg: TrackingGroupBuilder): TrackingGroup {
    return {
      keys: Array.from(tg.keys),
      outliers: tg.outliers(),
      interval: [`${tg.interval.start}`, `${tg.interval.end}`],
      averageLine: tg.averageLine().points.map((point) => [point.x, point.y])
    }
  }

  private generateTrackingZoneMetadata(tz: TrackingZoneBuilder): TrackingZone {
    return {
      groups: tz.trackingGroups.map((tg) => this.generateTrackingGroupMetadata(tg)),
      interval: [`${tz.interval.start}`, `${tz.interval.end}`]
    }
  }
  
}