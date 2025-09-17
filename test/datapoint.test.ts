import { expect, test } from 'vitest';

import { Datapoint } from '../lib';
import { NumberBox } from '../lib/dataframe/box'

test('Datapoint Value Equality', () => {
  const datapoint1 = new Datapoint({ x: new NumberBox('1'), y: new NumberBox('2') }, 'seriesA', 0);
  const datapoint2 = new Datapoint({ x: new NumberBox('1'), y: new NumberBox('2') }, 'seriesA', 0);
  const datapoint3 = new Datapoint({ x: new NumberBox('3'), y: new NumberBox('2') }, 'seriesA', 0);
  expect(datapoint1.equals(datapoint2)).toBeTruthy();
  expect(datapoint1.equals(datapoint3)).toBeFalsy();
})