import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { 'cli/index': 'src/cli/index.ts' },
    format: ['esm'],
    target: 'node20',
    outDir: 'dist',
    clean: true,
    splitting: true,
    sourcemap: true,
    dts: false,
    external: ['better-sqlite3', 'commander', 'obsidian-ts'],
    noExternal: ['nanoid'],
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
