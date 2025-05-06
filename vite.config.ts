import { defineConfig } from 'vite'

/*
It looks like we have to specifically exclude resolved module IDs, i.e.,
the full, absolute path to the module within node_modules. 
*/
function matchExternal(id: string, parentId: string | undefined, isResolved: boolean) {
  if (id.match(/lit|ui-components/)) {
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
      // don't include lit or ui-components in the bundled NPM package
      external: matchExternal
    }
  },
  plugins: []
})
