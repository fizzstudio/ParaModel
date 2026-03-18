import { expect, test } from 'vitest';

import { type CatalogListing } from '@fizz/chart-data';
import { loadChartDataManifest } from '@fizz/test-utils';

import CHART_CATALOG from '../node_modules/@fizz/chart-data/data/chart_catalog.json' with { type: "json" };

import { modelFromInlineManifest } from '../lib';

test.each(CHART_CATALOG as CatalogListing[])('Smoke test: $title', async ({ path, external }) => {
  if (!external) {
    const manifest = await loadChartDataManifest(path, true, 'ParaModel smoke test');
    const model = modelFromInlineManifest(manifest);
    expect(model).toBeTruthy();
  }
})