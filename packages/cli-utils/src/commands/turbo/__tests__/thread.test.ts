import * as path from 'node:path';
import { describe, it, expect } from 'vitest';

import { shouldScanTurboFile } from '../scan';

describe('shouldScanTurboFile', () => {
  it('excludes generated cache, declarations, and node_modules files', () => {
    const root = path.resolve('/project');
    const turboOutputPath = path.join(root, 'src', 'graphql-cache.d.ts');
    const turboOutputPaths = new Set([turboOutputPath]);

    expect(shouldScanTurboFile(path.join(root, 'src', 'documents.ts'), turboOutputPaths)).toBe(
      true
    );
    expect(shouldScanTurboFile(turboOutputPath, turboOutputPaths)).toBe(false);
    expect(shouldScanTurboFile(path.join(root, 'src', 'graphql-env.d.ts'), turboOutputPaths)).toBe(
      false
    );
    expect(shouldScanTurboFile(path.join(root, 'types', 'env.d.mts'), turboOutputPaths)).toBe(
      false
    );
    expect(
      shouldScanTurboFile(
        path.join(root, 'node_modules', '@types', 'react', 'index.d.ts'),
        turboOutputPaths
      )
    ).toBe(false);
    expect(
      shouldScanTurboFile(path.join(root, 'node_modules', 'pkg', 'index.ts'), turboOutputPaths)
    ).toBe(false);
  });
});
