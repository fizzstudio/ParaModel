import { expect, test } from 'vitest';

import { Temporal } from 'temporal-polyfill';

import { utcTimestampToPlainDateTime } from '../lib';
import { convertStandardFormatToDateValue, formatDateValue, parseDateToStandardFormat } from '../lib/dataframe/date';

test('utcTimestampToPlainDateTime', () => {
  const actual = utcTimestampToPlainDateTime(1199145600000);
  const expected = Temporal.PlainDateTime.from('2008-01-01T00:00:00');
  expect(Temporal.PlainDateTime.compare(actual, expected)).toBe(0);
})

test('formatDateValue', () => {
  const actualDateValue = convertStandardFormatToDateValue(parseDateToStandardFormat('M202510')!);
  const expectDateValue = {
    type: 'date',
    start: Temporal.PlainDateTime.from('20251001'),
    duration: Temporal.Duration.from('P1M')
  };
  expect(actualDateValue).toStrictEqual(expectDateValue);
  const actualText = formatDateValue(actualDateValue);
  const expectText = 'October 2025';
  expect(actualText).toBe(expectText);
})
