import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import { parseJSONC, readProjectConfig } from '../config';

let root: string;

const write = (file: string, content: string) => {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  return target;
};

beforeEach(() => {
  root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'content-mapper-config-')));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('parseJSONC', () => {
  it('accepts comments, trailing commas and a BOM, but keeps strings intact', () => {
    const input = '﻿{\n  // comment\n  "a": "//not a comment", /* block */\n  "b": [1, 2,],\n}\n';
    expect(parseJSONC(input)).toEqual({ a: '//not a comment', b: [1, 2] });
  });

  it('treats blank files as empty configs', () => {
    expect(parseJSONC('  \n')).toEqual({});
  });
});

describe('readProjectConfig', () => {
  it('reads a single SDL schema relative to the project tsconfig', () => {
    const tsconfig = write(
      'tsconfig.json',
      `{
        "compilerOptions": {
          // GraphQLSP's config
          "plugins": [{ "name": "@0no-co/graphqlsp", "schema": "./schema.graphql", "tadaOutputLocation": "./src/graphql-env.d.ts" }],
        },
      }`
    );
    expect(readProjectConfig(tsconfig)).toEqual({
      schemas: [{ file: path.join(root, 'schema.graphql') }],
      configFiles: [tsconfig],
    });
  });

  it('follows extends and resolves paths against the extending tsconfig', () => {
    const base = write(
      'configs/base.json',
      JSON.stringify({
        compilerOptions: {
          plugins: [
            {
              name: 'gql.tada/ts-plugin',
              schemas: [
                { name: 'a', schema: './schemas/a.graphql', tadaOutputLocation: './a.d.ts' },
                { name: 'b', schema: '${configDir}/schemas/b.gql', tadaOutputLocation: './b.d.ts' },
                {
                  name: 'c',
                  schema: 'https://example.com/graphql',
                  tadaOutputLocation: './c.d.ts',
                },
                { name: 'd', schema: './schemas/d.json', tadaOutputLocation: './d.d.ts' },
              ],
            },
          ],
        },
      })
    );
    const tsconfig = write('tsconfig.json', JSON.stringify({ extends: './configs/base' }));
    expect(readProjectConfig(tsconfig)).toEqual({
      schemas: [
        { file: path.join(root, 'schemas/a.graphql'), name: 'a' },
        { file: path.join(root, 'schemas/b.gql'), name: 'b' },
      ],
      configFiles: [tsconfig, base],
    });
  });

  it('follows extends into packages', () => {
    write(
      'node_modules/shared-config/tsconfig.json',
      JSON.stringify({
        compilerOptions: { plugins: [{ name: '@0no-co/graphqlsp', schema: './schema.graphql' }] },
      })
    );
    write('node_modules/shared-config/package.json', JSON.stringify({ name: 'shared-config' }));
    const tsconfig = write('tsconfig.json', JSON.stringify({ extends: 'shared-config' }));
    expect(readProjectConfig(tsconfig).schemas).toEqual([
      { file: path.join(root, 'schema.graphql') },
    ]);
  });

  it('prefers the nearest plugin config', () => {
    write(
      'base.json',
      JSON.stringify({
        compilerOptions: { plugins: [{ name: '@0no-co/graphqlsp', schema: './base.graphql' }] },
      })
    );
    const tsconfig = write(
      'tsconfig.json',
      JSON.stringify({
        extends: './base.json',
        compilerOptions: { plugins: [{ name: '@0no-co/graphqlsp', schema: './own.graphql' }] },
      })
    );
    expect(readProjectConfig(tsconfig).schemas).toEqual([{ file: path.join(root, 'own.graphql') }]);
  });

  it('returns no schemas without a plugin config, a config file, or for cyclic extends', () => {
    const tsconfig = write('tsconfig.json', JSON.stringify({ compilerOptions: { strict: true } }));
    expect(readProjectConfig(tsconfig).schemas).toEqual([]);
    expect(readProjectConfig('')).toEqual({ schemas: [], configFiles: [] });
    const cyclic = write('a.json', JSON.stringify({ extends: './b.json' }));
    write('b.json', JSON.stringify({ extends: './a.json' }));
    expect(readProjectConfig(cyclic).schemas).toEqual([]);
  });
});
