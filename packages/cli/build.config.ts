import { defineBuildConfig } from 'unbuild';

export default defineBuildConfig({
  outDir: 'dist',
  externals: ['unblocked', 'better-call'],
  entries: ['./src/index.ts'],
});
