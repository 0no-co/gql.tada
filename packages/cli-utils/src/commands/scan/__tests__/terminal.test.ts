import { buildSchema } from 'graphql';
import { describe, it, expect } from 'vitest';

import { analyze } from '../analyze';
import { renderTerminalReport } from '../output/terminal';
import type { RawScanDocument, SchemaName } from '../types';

const schema = buildSchema(`
  type Query { aVeryLongAndQuiteExcessiveFieldNameForTesting: String }
`);
const schemas = new Map<SchemaName, ReturnType<typeof buildSchema>>([[null, schema]]);

// eslint-disable-next-line no-control-regex
const stripAnsi = (s: string): string => s.replace(/\x1b\[[0-9;]*m/g, '');

const doc = (document: string, filePath: string): RawScanDocument => ({
  schemaName: null,
  document,
  filePath,
  line: 1,
  col: 1,
});

describe('renderTerminalReport width fitting', () => {
  const { context, rules } = analyze({
    documents: [
      doc(
        'query AnExtremelyLongOperationNameUsedForTesting { aVeryLongAndQuiteExcessiveFieldNameForTesting }',
        '/some/deeply/nested/path/to/a/module/file.ts'
      ),
    ],
    schemas,
    imports: new Map(),
    warnings: [],
  });

  it('keeps tree item and description lines within the given width', () => {
    const width = 40;
    const report = renderTerminalReport(context, rules, width);
    for (const line of report.split('\n')) {
      const plain = stripAnsi(line);
      // Item lines (tree connectors) and the indented description must fit.
      if (/[├└]/.test(plain) || plain.startsWith('  ')) {
        expect(plain.length).toBeLessThanOrEqual(width);
      }
    }
  });

  it('does not truncate when no width is given', () => {
    const report = stripAnsi(renderTerminalReport(context, rules));
    expect(report).toContain('AnExtremelyLongOperationNameUsedForTesting');
  });
});
