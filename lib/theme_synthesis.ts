import { Theme } from "@fizz/paramanifest";
import { Model } from "./model/model";

export function synthesizeChartTheme(model: Model): Theme | null {
  if (model.numSeries === 1) {
    return model.getSeriesTheme(model.seriesKeys[0]);
  }
  return null;
}