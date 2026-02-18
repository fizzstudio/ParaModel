import { BaseKind, Topic } from "@fizz/paramanifest";
import { Model } from "./model/model";

function decapitalize(titleStr: string): string {
  if (titleStr === '') {
    return '';
  }
  return titleStr[0].toLowerCase() + titleStr.slice(1);
}

function synthesizeThemeFromLabel(label: string, baseKind: BaseKind): Topic {
  let baseQuantity = decapitalize(label);
  if (baseKind === 'proportion' && baseQuantity.startsWith('proportion of ')) {
    baseQuantity = baseQuantity.slice('proportion of '.length);
  }
  return { baseQuantity, baseKind };
}

export function synthesizeChartTheme(model: Model): Topic {
  if (!model.multi) {
    return model.getSeriesTopic(model.seriesKeys[0])!;
  }
  const baseKind = model.family === 'pastry' ? 'proportion' : 'number';
  return synthesizeThemeFromLabel(model.title ?? 'value', baseKind);
}

export function synthesizeSeriesTheme(seriesKey: string, model: Model): Topic {
  if (!model.multi && model.hasExplictChartTopic()) {
    return model.getChartTopic();
  }
  const baseKind = model.family === 'pastry' ? 'proportion' : 'number';
  return synthesizeThemeFromLabel(model.atKey(seriesKey)!.label, baseKind);
}