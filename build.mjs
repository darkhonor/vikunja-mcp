/**
 * Filename: build.mjs
 * Last Modified: 2026-03-15
 * Summary: esbuild configuration for bundling MCP server
 * Compliant With: DoD STIG, NIST SP800-53 Rev 5 (SA-11)
 * Classification: UNCLASSIFIED
 */

import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/index.js',
  banner: {
    js: '#!/usr/bin/env node',
  },
  external: [],
  minify: false,
  sourcemap: process.env.SOURCEMAP !== 'false',
});

console.log('Build complete: dist/index.js');
