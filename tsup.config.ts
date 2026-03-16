import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { 'mcp/server': 'src/mcp/server.ts' },
    format: ['esm'],
    target: 'node20',
    outDir: 'dist',
    clean: true,
    splitting: true,
    sourcemap: true,
    dts: false,
    external: ['better-sqlite3'],
  },
  {
    entry: { 'cli/index': 'src/cli/index.ts' },
    format: ['esm'],
    target: 'node20',
    outDir: 'dist',
    splitting: true,
    sourcemap: true,
    dts: false,
    external: ['better-sqlite3'],
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
