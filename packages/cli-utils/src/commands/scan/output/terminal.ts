import * as path from 'node:path';
import * as t from '../../../term';

import type { ScanContext } from '../context';
import type { RuleResults, DatapointRef } from '../types';
import type { CoverageData } from '../rules/schema-coverage';

const CWD = process.cwd();
/** Maximum datapoints shown per rule in the terminal report. */
const MAX_PER_RULE = 8;

const relative = (filePath: string): string => {
  const rel = path.relative(CWD, filePath);
  return !rel.startsWith('..') ? rel : filePath;
};

/** Resolves a datapoint's `ref` to a short `file:line` locator, where one exists. */
function locator(ref: DatapointRef, context: ScanContext): string | undefined {
  switch (ref.kind) {
    case 'operation': {
      const op = context.operations.find((item) => item.id === ref.id);
      return op ? `${relative(op.loc.file)}:${op.loc.line}` : undefined;
    }
    case 'fragment': {
      const fragment = context.fragments.find((item) => item.id === ref.id);
      return fragment ? `${relative(fragment.loc.file)}:${fragment.loc.line}` : undefined;
    }
    default:
      return undefined;
  }
}

function coverageLine(rules: RuleResults): string {
  let used = 0;
  let total = 0;
  for (const datapoint of rules['schema-coverage'] || []) {
    const data = datapoint.data as CoverageData;
    used += data.usedFields;
    total += data.totalFields;
  }
  const percent = total ? Math.round((used / total) * 100) : 100;
  return t.text([
    t.cmd(t.CSI.Style, t.Style.Foreground),
    'Schema coverage: ',
    t.cmd(t.CSI.Style, t.Style.BrightBlue),
    `${percent}% `,
    t.cmd(t.CSI.Style, t.Style.BrightBlack),
    `(${used}/${total} fields used)\n`,
  ]);
}

/** Renders the default human-facing report: coverage plus the top datapoints of
 * each rule that produced findings. */
export function renderTerminalReport(context: ScanContext, rules: RuleResults): string {
  let out = '\n' + coverageLine(rules);

  for (const [name, datapoints] of Object.entries(rules)) {
    if (!datapoints.length) continue;

    out += t.text([
      '\n',
      t.cmd(t.CSI.Style, t.Style.Magenta),
      `${t.SmallTriangle.Right} `,
      t.cmd(t.CSI.Style, t.Style.Foreground),
      name,
      t.cmd(t.CSI.Style, t.Style.BrightBlack),
      ` (${datapoints.length})\n`,
    ]);

    for (const datapoint of datapoints.slice(0, MAX_PER_RULE)) {
      const where = locator(datapoint.ref, context);
      out += t.text([
        t.cmd(t.CSI.Style, t.Style.BrightBlack),
        `  ${t.HeavyBox.BottomLeft} `,
        t.cmd(t.CSI.Style, t.Style.Foreground),
        datapoint.message,
        ...(datapoint.weight != null
          ? [t.cmd(t.CSI.Style, t.Style.BrightBlue), `  ~${datapoint.weight}`]
          : []),
        ...(where ? [t.cmd(t.CSI.Style, t.Style.BrightBlack), `  ${where}`] : []),
        '\n',
      ]);
    }

    if (datapoints.length > MAX_PER_RULE) {
      out += t.text([
        t.cmd(t.CSI.Style, t.Style.BrightBlack),
        `    ${t.Chars.Ellipsis} and ${datapoints.length - MAX_PER_RULE} more\n`,
      ]);
    }
  }

  return out;
}
