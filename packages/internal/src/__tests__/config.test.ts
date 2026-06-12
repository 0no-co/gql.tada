import * as path from 'node:path';
import { describe, it, expect } from 'vitest';

import type { GraphQLSPConfig } from '../config';
import { validateUniqueOutputLocations } from '../config';

const ROOT = path.resolve('/projects');

describe('validateUniqueOutputLocations', () => {
  it('passes for projects with distinct output locations', () => {
    expect(() =>
      validateUniqueOutputLocations([
        {
          projectPath: path.join(ROOT, 'a'),
          config: { schema: './schema.graphql', tadaOutputLocation: './graphql-env.d.ts' },
        },
        {
          projectPath: path.join(ROOT, 'b'),
          config: { schema: './schema.graphql', tadaOutputLocation: './graphql-env.d.ts' },
        },
      ])
    ).not.toThrow();
  });

  it('throws when two projects resolve an output location to the same file', () => {
    expect(() =>
      validateUniqueOutputLocations([
        {
          projectPath: path.join(ROOT, 'a'),
          config: { schema: './schema.graphql', tadaOutputLocation: '../graphql-env.d.ts' },
          label: 'a/tsconfig.json',
        },
        {
          projectPath: path.join(ROOT, 'b'),
          config: { schema: './schema.graphql', tadaOutputLocation: '../graphql-env.d.ts' },
          label: 'b/tsconfig.json',
        },
      ])
    ).toThrow(/'a\/tsconfig\.json' and 'b\/tsconfig\.json'/);
  });

  it('throws when multi-schema and single-schema projects overlap', () => {
    const multi: GraphQLSPConfig = {
      schemas: [
        {
          name: 'a',
          schema: './a.graphql',
          tadaOutputLocation: path.join(ROOT, 'shared.d.ts'),
        },
      ],
    };
    expect(() =>
      validateUniqueOutputLocations([
        { projectPath: path.join(ROOT, 'a'), config: multi },
        {
          projectPath: ROOT,
          config: { schema: './schema.graphql', tadaOutputLocation: './shared.d.ts' },
        },
      ])
    ).toThrow(/tadaOutputLocation/);
  });

  it('ignores repeated locations within the same project', () => {
    expect(() =>
      validateUniqueOutputLocations([
        {
          projectPath: ROOT,
          config: { schema: './schema.graphql', tadaOutputLocation: './graphql-env.d.ts' },
          label: 'tsconfig.json',
        },
        {
          projectPath: ROOT,
          config: { schema: './schema.graphql', tadaOutputLocation: './graphql-env.d.ts' },
          label: 'tsconfig.json',
        },
      ])
    ).not.toThrow();
  });
});
