import { defineConfig } from 'vitest/config';

function externalize(id: string, _parentId: string | undefined, _isResolved: boolean) {
  if (id.match(/paramanifest/)) {
    return true;
  }
  return false;
}

export default defineConfig({
  build: {
    sourcemap: true,
    lib: {
      entry: './lib/index.ts',
      formats: ['es']
    },
    rollupOptions: {
      external: externalize
    }
  },
  plugins: [],
  test: {
    browser: {
      enabled: true,
      name: 'chrome',
      //headless: true, // set to false to watch in a real browser window
    }
  }
})
