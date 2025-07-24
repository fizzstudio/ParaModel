import { BaseKind, Theme } from "@fizz/paramanifest";
import { Model } from "./model/model";

function decapitalize(titleStr: string): string {
  if (titleStr === '') {
    return '';
  }
  return titleStr[0].toLowerCase() + titleStr.slice(1);
}

function synthesizeThemeFromLabel(label: string, baseKind: BaseKind): Theme {
  let baseQuantity = decapitalize(label);
  if (baseKind === 'proportion' && baseQuantity.startsWith('proportion of ')) {
    baseQuantity = baseQuantity.slice('proportion of '.length);
  }
  return { baseQuantity, baseKind };
}

export function synthesizeChartTheme(model: Model): Theme {
  if (!model.multi) {
    return model.getSeriesTheme(model.seriesKeys[0])!;
  }
  const baseKind = model.family === 'pastry' ? 'proportion' : 'number';
  return synthesizeThemeFromLabel(model.title ?? 'value', baseKind);
}

export function synthesizeSeriesTheme(seriesKey: string, model: Model): Theme {
  if (!model.multi && model.hasExplictChartTheme()) {
    return model.getChartTheme();
  }
  const baseKind = model.family === 'pastry' ? 'proportion' : 'number';
  return synthesizeThemeFromLabel(model.atKey(seriesKey)!.label, baseKind);
}