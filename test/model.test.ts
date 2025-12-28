import { expect, test } from 'vitest';

import { loadChartDataManifest } from '@fizz/test-utils';
import { planeModelFromInlineData } from '../lib';

test('getChordAt', async () => {
  const manifest = await loadChartDataManifest(
    'manifests/autogen/line-multi/line-multi-manifest-16.json', true, 'ParaModel smoke test');
  const model = planeModelFromInlineData(manifest);
  const startChord = model.getChordAt('x', model.atKeyAndIndex('agriculture', 0)!.indepBox)!;
  expect(startChord.length).not.toBe(0);
})