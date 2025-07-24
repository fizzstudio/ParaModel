import { Theme } from "@fizz/paramanifest";
import { Model } from "./model/model";

function decapitalize(titleStr: string): string {
  if (titleStr === '') {
    return '';
  }
  return titleStr[0].toLowerCase() + titleStr.slice(1);
}

export function synthesizeChartTheme(model: Model): Theme | null {
  if (!model.multi) {
    return model.getSeriesTheme(model.seriesKeys[0]);
  }
  return null;
}

export function synthesizeSeriesTheme(seriesKey: string, model: Model): Theme | null {
  if (!model.multi && model.hasExplictChartTheme()) {
    return model.getChartTheme();
  }
  const baseKind = model.family === 'pastry' ? 'proportion' : 'number';
  let baseQuantity = decapitalize(model.atKey(seriesKey)!.label);
  if (baseKind === 'proportion' && baseQuantity.startsWith('proportion of ')) {
    baseQuantity = baseQuantity.slice('proportion of '.length);
  }
  return { baseQuantity, baseKind };
}