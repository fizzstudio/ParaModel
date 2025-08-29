import { expect, test } from 'vitest';

import { utcTimestampToPlainDateTime } from '../lib';
import { Temporal } from 'temporal-polyfill';

test('utcTimestampToPlainDateTime', () => {
  const actual = utcTimestampToPlainDateTime(1199145600000);
  const expected = Temporal.PlainDateTime.from('2008-01-01T00:00:00');
  expect(Temporal.PlainDateTime.compare(actual, expected)).toBe(0);
})
