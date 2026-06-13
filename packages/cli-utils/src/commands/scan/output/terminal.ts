import * as path from 'node:path';
import * as t from '../../../term';

import type { ScanContext } from '../context';
import type { RuleResults, DatapointRef } from '../types';
import { DEFAULT_RULES } from '../rules';
import { buildOverview } from './overview';

const CWD = process.cwd();
/** Maximum datapoints shown per rule in the terminal report. */
const MAX_PER_RULE = 8;

const RULE_DESCRIPTIONS = new Map(DEFAULT_RULES.map((rule) => [rule.name, rule.description]));

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

function coverageLine(context: ScanContext, rules: RuleResults): string {
  const { usedFields, totalFields, percent } = buildOverview(context, rules).coverage;
  return t.text([
    t.cmd(t.CSI.Style, t.Style.Foreground),
    'Schema coverage: ',
    t.cmd(t.CSI.Style, t.Style.BrightBlue),
    `${percent}% `,
    t.cmd(t.CSI.Style, t.Style.BrightBlack),
    `(${usedFields}/${totalFields} fields used)\n`,
  ]);
}

/** Renders the default human-facing report: coverage plus the top datapoints of
 * each rule that produced findings. */
export function renderTerminalReport(context: ScanContext, rules: RuleResults): string {
  let out = '\n' + coverageLine(context, rules);

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

    const description = RULE_DESCRIPTIONS.get(name);
    if (description) {
      out += t.text([t.cmd(t.CSI.Style, t.Style.BrightBlack), `  ${description}\n`]);
    }

    const shown = datapoints.slice(0, MAX_PER_RULE);
    const truncated = datapoints.length > shown.length;
    shown.forEach((datapoint, index) => {
      const isLast = !truncated && index === shown.length - 1;
      const where = locator(datapoint.ref, context);
      out += t.text([
        t.cmd(t.CSI.Style, t.Style.BrightBlack),
        `  ${isLast ? t.Box.BottomLeft : t.Box.VerticalRight} `,
        t.cmd(t.CSI.Style, t.Style.Foreground),
        datapoint.message,
        ...(datapoint.weight != null
          ? [t.cmd(t.CSI.Style, t.Style.BrightBlue), `  ~${datapoint.weight}`]
          : []),
        ...(where ? [t.cmd(t.CSI.Style, t.Style.BrightBlack), `  ${where}`] : []),
        '\n',
      ]);
    });

    if (truncated) {
      out += t.text([
        t.cmd(t.CSI.Style, t.Style.BrightBlack),
        `  ${t.Box.BottomLeft} ${t.Chars.Ellipsis} and ${datapoints.length - shown.length} more\n`,
      ]);
    }
  }

  return out;
}
