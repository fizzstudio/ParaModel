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
      api: {
        port: 5175,
      },
      enabled: true,
      instances: [
        {
          browser: 'chrome',
          headless: true
        }
      ]
      //headless: true, // set to false to watch in a real browser window
    }
  }
})
