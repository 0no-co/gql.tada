import fs from 'node:fs/promises';
import path from 'node:path/posix';
import { readFileSync } from 'node:fs';

import * as prettier from 'prettier';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import babel from '@rollup/plugin-babel';
import terser from '@rollup/plugin-terser';
import cjsCheck from 'rollup-plugin-cjs-check';
import dts from 'rollup-plugin-dts';

const normalize = name => []
  .concat(name)
  .join(' ')
  .replace(/[@\s/.]+/g, ' ')
  .trim()
  .replace(/\s+/, '-')
  .toLowerCase();

const extension = name => {
  if (/\.d.ts$/.test(name)) {
    return '.d.ts';
  } else {
    return path.extname(name);
  }
};

const meta = JSON.parse(readFileSync('package.json'));
const name = normalize(meta.name);

const externalModules = [
  ...Object.keys(meta.dependencies || {}),
  ...Object.keys(meta.peerDependencies || {}),
];

const external = new RegExp(`^(${externalModules.join('|')})($|/)`);

const exports = {};
for (const key in meta.exports) {
  const entry = meta.exports[key];
  if (typeof entry === 'object' && !!entry.source) {
    const entryPath = normalize(key);
    const entryName = normalize([name, entryPath]);
    exports[entryName] = {
      path: entryPath,
      ...entry,
    };
  }
}

const commonConfig = {
  input: Object.entries(exports).reduce((input, [exportName, entry]) => {
    input[exportName] = entry.source;
    return input;
  }, {}),
  onwarn: () => {},
  external(id) {
    return external.test(id);
  },
  treeshake: {
    unknownGlobalSideEffects: false,
    tryCatchDeoptimization: false,
    moduleSideEffects: false,
  },
};

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

const commonOutput = {
  dir: './',
  exports: 'auto',
  sourcemap: true,
  sourcemapExcludeSources: false,
  hoistTransitiveImports: false,
  indent: false,
  freeze: false,
  strict: false,
  generatedCode: {
    preset: 'es5',
    reservedNamesAsProps: false,
    objectShorthand: false,
    constBindings: false,
  },
};

const outputPlugins = [
  {
    name: 'outputPackageJsons',
    async writeBundle() {
      for (const key in exports) {
        const entry = exports[key];
        if (entry.path) {
          const output = path.relative(entry.path, process.cwd());
          const json = JSON.stringify({
            name: key,
            private: true,
            version: '0.0.0',
            main: path.join(output, entry.require),
            module: path.join(output, entry.import),
            types: path.join(output, entry.types),
            source: path.join(output, entry.source),
            exports: {
              '.': {
                types: path.join(output, entry.types),
                import: path.join(output, entry.import),
                require: path.join(output, entry.require),
                source: path.join(output, entry.source),
              },
            },
          }, null, 2);

          await fs.mkdir(entry.path, { recursive: true });
          await fs.writeFile(path.join(entry.path, 'package.json'), json);
        }
      }
    },
  },

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
];

export default [
  {
    ...commonConfig,
    plugins: [
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
    ],
    output: [
      {
        ...commonOutput,
        format: 'esm',
        chunkFileNames(chunk) {
          return `dist/chunks/[name]-chunk${extension(chunk.name) || '.mjs'}`;
        },
        entryFileNames(chunk) {
          return chunk.isEntry
            ? path.normalize(exports[chunk.name].import)
            : `dist/[name].mjs`;
        },
        plugins: outputPlugins,
      },
      {
        ...commonOutput,
        format: 'cjs',
        esModule: true,
        externalLiveBindings: true,
        chunkFileNames(chunk) {
          return `dist/chunks/[name]-chunk${extension(chunk.name) || '.js'}`;
        },
        entryFileNames(chunk) {
          return chunk.isEntry
            ? path.normalize(exports[chunk.name].require)
            : `dist/[name].js`;
        },
        plugins: outputPlugins,
      },
    ],
  },

  {
    ...commonConfig,
    plugins: [
      ...commonPlugins,
      dts(),
    ],
    output: {
      ...commonOutput,
      sourcemap: false,
      format: 'dts',
      chunkFileNames(chunk) {
        return `dist/chunks/[name]-chunk${extension(chunk.name) || '.d.ts'}`;
      },
      entryFileNames(chunk) {
        return chunk.isEntry
          ? path.normalize(exports[chunk.name].types)
          : `dist/[name].d.ts`;
      },
      plugins: [
        {
          renderChunk(code, chunk) {
            if (chunk.fileName.endsWith('d.ts')) {
              const gqlImportRe = /(import\s+(?:[*\s{}\w\d]+)\s*from\s*'graphql';?)/g;
              code = code.replace(gqlImportRe, x => '/*!@ts-ignore*/\n' + x);

              code = prettier.format(code, {
                filepath: chunk.fileName,
                parser: 'typescript',
                singleQuote: true,
                tabWidth: 2,
                printWidth: 100,
                trailingComma: 'es5',
              });

              return code;
            }
          },
        },
      ],
    },
  },
];
