import esbuild from 'rollup-plugin-esbuild';
import dts from 'rollup-plugin-dts';

export default [
  {
    input: `src/index.ts`,
    plugins: [esbuild()],
    output: [
      {
        file: `dist/index.js`,
        format: 'cjs',
        sourcemap: true,
        exports: 'named',
      },
    ],
  },
  {
    input: `src/index.ts`,
    plugins: [dts()],
    output: [
      {
        file: `dist/index.d.ts`,
        format: 'es',
      },
    ],
  },
];
