import { readFileSync } from 'node:fs';

import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';
import cjsCheck from 'rollup-plugin-cjs-check';
import dts from 'rollup-plugin-dts';

const commonPlugins = [
  resolve({
    extensions: ['.mjs', '.js', '.ts'],
    mainFields: ['module', 'jsnext', 'main'],
    preferBuiltins: false,
    browser: true,
  }),

  commonjs({
    ignoreGlobal: true,
    include: /\/node_modules\//,
  }),
];

const packageJson = JSON.parse(readFileSync('package.json'));
const externalModules = Object.keys(packageJson.dependencies);
const externalPredicate = new RegExp(`^(${externalModules.join('|')})($|/)`);
const external = (id) => externalPredicate.test(id);

const jsPlugins = [
  ...commonPlugins,

  babel({
    babelrc: false,
    babelHelpers: 'bundled',
    extensions: ['mjs', 'js', 'jsx', 'ts', 'tsx'],
    exclude: 'node_modules/**',
    presets: [],
    plugins: [
      '@babel/plugin-transform-typescript',
      '@babel/plugin-transform-block-scoping',
    ],
  }),
];

const dtsPlugins = [
  ...commonPlugins,
  dts(),
];

const output = format => {
  const extension = format === 'esm' ? '.mjs' : '.js';
  return {
    chunkFileNames: '[hash]' + extension,
    entryFileNames: '[name]' + extension,
    dir: './dist',
    exports: 'named',
    sourcemap: true,
    sourcemapExcludeSources: false,
    indent: false,
    freeze: false,
    strict: false,
    format,
    // NOTE: All below settings are important for cjs-module-lexer to detect the export
    // When this changes (and terser mangles the output) this will interfere with Node.js ESM intercompatibility
    esModule: format !== 'esm',
    externalLiveBindings: format !== 'esm',
    plugins: [
      cjsCheck(),

      terser({
        warnings: true,
        ecma: 2015,
        keep_fnames: true,
        ie8: false,
        compress: {
          pure_getters: true,
          toplevel: true,
          booleans_as_integers: false,
          keep_fnames: true,
          keep_fargs: true,
          if_return: false,
          ie8: false,
          sequences: false,
          loops: false,
          conditionals: false,
          join_vars: false,
        },
        mangle: {
          module: true,
          keep_fnames: true,
        },
        output: {
          beautify: true,
          braces: true,
          indent_level: 2,
        },
      }),
    ],
    generatedCode: {
      preset: 'es5',
      reservedNamesAsProps: false,
      objectShorthand: false,
      constBindings: false,
    },
  };
};

const commonConfig = {
  input: {
    'gql-tada': './src/index.ts',
  },
  onwarn: () => {},
  external,
  treeshake: {
    unknownGlobalSideEffects: false,
    tryCatchDeoptimization: false,
    moduleSideEffects: false,
  },
};

const jsConfig = {
  ...commonConfig,
  plugins: jsPlugins,
  output: [
    output('esm'),
    output('cjs'),
  ],
};

const dtsConfig = {
  ...commonConfig,
  input: {
    'gql-tada': './src/index.ts',
  },
  onwarn: () => {},
  external,
  plugins: dtsPlugins,
  treeshake: {
    unknownGlobalSideEffects: false,
    tryCatchDeoptimization: false,
    moduleSideEffects: false,
  },
  output: {
    dir: './dist',
    entryFileNames: '[name].d.ts',
    format: 'es',
    plugins: [
      {
        renderChunk(code, chunk) {
          if (chunk.fileName.endsWith('d.ts')) {
            const gqlImportRe = /(import\s+(?:[*\s{}\w\d]+)\s*from\s*'graphql';?)/g;
            return code.replace(gqlImportRe, x => '/*!@ts-ignore*/\n' + x);
          }
        },
      },
    ],
  },
};

export default [
  jsConfig,
  dtsConfig,
];
