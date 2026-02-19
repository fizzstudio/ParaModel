import { BaseKind, Topic } from "@fizz/paramanifest";
import { Model } from "./model/model";

function decapitalize(titleStr: string): string {
  if (titleStr === '') {
    return '';
  }
  return titleStr[0].toLowerCase() + titleStr.slice(1);
}

function synthesizeTopicFromLabel(label: string, baseKind: BaseKind): Topic {
  let baseQuantity = decapitalize(label);
  if (baseKind === 'proportion' && baseQuantity.startsWith('proportion of ')) {
    baseQuantity = baseQuantity.slice('proportion of '.length);
  }
  return { baseQuantity, baseKind };
}

export function synthesizeChartTopic(model: Model): Topic {
  if (!model.multi) {
    return model.getSeriesTopic(model.seriesKeys[0])!;
  }
  const baseKind = model.family === 'pastry' ? 'proportion' : 'number';
  return synthesizeTopicFromLabel(model.title ?? 'value', baseKind);
}

export function synthesizeSeriesTopic(seriesKey: string, model: Model): Topic {
  if (!model.multi && model.hasExplictChartTopic()) {
    return model.getChartTopic();
  }
  const baseKind = model.family === 'pastry' ? 'proportion' : 'number';
  return synthesizeTopicFromLabel(model.atKey(seriesKey)!.label, baseKind);
}