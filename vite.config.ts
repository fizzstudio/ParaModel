import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    sourcemap: true,
    lib: {
      entry: './lib/index.ts',
      formats: ['es']
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
