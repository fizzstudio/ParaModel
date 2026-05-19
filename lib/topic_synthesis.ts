import { BaseKind, Topic } from "@fizz/paramanifest";
//import { uncapitalize } from "@fizz/templum";

import { Model } from "./model/model";

function synthesizeTopicFromLabel(label: string, baseKind: BaseKind): Topic {
  // TODO (@simonvarey): Labels will usually be capitalized, regardless of what sort of word they are.
  //   The label was originally uncapitalized due to this fact, but this will produce the wrong result
  //   for words that should always be capitalized, i.e. Proper Nouns like 'Vietnam' or 'Fizz Studio'.
  //   I am currently not sure how to fix this, so I have temporarily removed uncapitalization as the
  //   safest option.
  let baseQuantity = label; //uncapitalize(label);
  if (baseKind === 'proportion' && baseQuantity.startsWith('proportion of ')) {
    baseQuantity = baseQuantity.slice('proportion of '.length);
  }
  return { baseQuantity, baseKind };
}

export function synthesizeChartTopic(model: Model): Topic {
  if (!model.multi) {
    return model.getSeriesTopic(model.seriesKeys[0])!;
  }
  const baseKind = model.family === 'pastry' ? 'proportion' : undefined;
  return synthesizeTopicFromLabel(model.title ?? 'value', baseKind);
}

export function synthesizeSeriesTopic(seriesKey: string, model: Model): Topic {
  if (!model.multi && model.hasExplictChartTopic()) {
    return model.getChartTopic();
  }
  const baseKind = model.family === 'pastry' ? 'proportion' : 'number';
  return synthesizeTopicFromLabel(model.atKey(seriesKey)!.label, baseKind);
}