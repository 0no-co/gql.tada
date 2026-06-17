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

  it('allows projects to share an output location when they resolve the same schema', () => {
    expect(() =>
      validateUniqueOutputLocations([
        {
          projectPath: path.join(ROOT, 'apps', 'a'),
          config: { schema: '../../schema.graphql', tadaOutputLocation: '../../graphql-env.d.ts' },
          label: 'apps/a/tsconfig.json',
        },
        {
          projectPath: path.join(ROOT, 'apps', 'b'),
          config: { schema: '../../schema.graphql', tadaOutputLocation: '../../graphql-env.d.ts' },
          label: 'apps/b/tsconfig.json',
        },
      ])
    ).not.toThrow();
  });

  it('still throws when a shared output location resolves to different schemas', () => {
    expect(() =>
      validateUniqueOutputLocations([
        {
          projectPath: path.join(ROOT, 'apps', 'a'),
          config: { schema: '../../a.graphql', tadaOutputLocation: '../../graphql-env.d.ts' },
          label: 'apps/a/tsconfig.json',
        },
        {
          projectPath: path.join(ROOT, 'apps', 'b'),
          config: { schema: '../../b.graphql', tadaOutputLocation: '../../graphql-env.d.ts' },
          label: 'apps/b/tsconfig.json',
        },
      ])
    ).toThrow(/tadaOutputLocation/);
  });

  it('still throws when projects share a turbo location, even with the same schema', () => {
    // Turbo caches are built from each project's own documents, not the schema.
    expect(() =>
      validateUniqueOutputLocations([
        {
          projectPath: path.join(ROOT, 'apps', 'a'),
          config: { schema: '../../schema.graphql', tadaTurboLocation: '../../graphql-cache.d.ts' },
          label: 'apps/a/tsconfig.json',
        },
        {
          projectPath: path.join(ROOT, 'apps', 'b'),
          config: { schema: '../../schema.graphql', tadaTurboLocation: '../../graphql-cache.d.ts' },
          label: 'apps/b/tsconfig.json',
        },
      ])
    ).toThrow(/tadaTurboLocation/);
  });

  it('still throws when projects share a persisted manifest location', () => {
    // Persisted manifests are built from each project's own documents, not the schema.
    expect(() =>
      validateUniqueOutputLocations([
        {
          projectPath: path.join(ROOT, 'apps', 'a'),
          config: { schema: '../../schema.graphql', tadaPersistedLocation: '../../persisted.json' },
          label: 'apps/a/tsconfig.json',
        },
        {
          projectPath: path.join(ROOT, 'apps', 'b'),
          config: { schema: '../../schema.graphql', tadaPersistedLocation: '../../persisted.json' },
          label: 'apps/b/tsconfig.json',
        },
      ])
    ).toThrow(/tadaPersistedLocation/);
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
