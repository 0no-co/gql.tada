import * as path from 'node:path';
import * as t from '../../../term';

import type { ScanContext } from '../context';
import type { RuleResults, DatapointRef } from '../types';
import { DEFAULT_RULES } from '../rules';
import { buildOverview } from './overview';

const CWD = process.cwd();
/** Maximum datapoints shown per rule in the terminal report. */
const MAX_PER_RULE = 8;
/** Below this many columns left for the message, the locator is dropped first. */
const MIN_MESSAGE_WIDTH = 24;

const RULE_DESCRIPTIONS = new Map(DEFAULT_RULES.map((rule) => [rule.name, rule.description]));

const truncate = (text: string, max: number): string =>
  text.length <= max
    ? text
    : max > 1
      ? text.slice(0, max - 1) + t.Chars.Ellipsis
      : t.Chars.Ellipsis;

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
 * each rule that produced findings. `width` (terminal columns) bounds each item
 * line so it doesn't wrap; omit it for unbounded output. */
export function renderTerminalReport(
  context: ScanContext,
  rules: RuleResults,
  width?: number
): string {
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
      const text = width ? truncate(description, Math.max(width - 2, 1)) : description;
      out += t.text([t.cmd(t.CSI.Style, t.Style.BrightBlack), `  ${text}\n`]);
    }

    const shown = datapoints.slice(0, MAX_PER_RULE);
    const truncated = datapoints.length > shown.length;
    // "  " + connector + " "
    const prefixWidth = 4;
    shown.forEach((datapoint, index) => {
      const isLast = !truncated && index === shown.length - 1;
      const weightText = datapoint.weight != null ? `~${datapoint.weight}` : '';
      let message = datapoint.message;
      let locText = locator(datapoint.ref, context);

      if (width) {
        const weightWidth = weightText ? weightText.length + 2 : 0;
        let locWidth = locText ? locText.length + 2 : 0;
        let budget = width - prefixWidth - weightWidth - locWidth;
        // Too cramped for the message — drop the (long) locator before the message.
        if (locText && budget < MIN_MESSAGE_WIDTH) {
          budget += locWidth;
          locText = undefined;
          locWidth = 0;
        }
        message = truncate(message, Math.max(budget, 1));
      }

      out += t.text([
        t.cmd(t.CSI.Style, t.Style.BrightBlack),
        `  ${isLast ? t.Box.BottomLeft : t.Box.VerticalRight} `,
        t.cmd(t.CSI.Style, t.Style.Foreground),
        message,
        ...(weightText ? [t.cmd(t.CSI.Style, t.Style.BrightBlue), `  ${weightText}`] : []),
        ...(locText ? [t.cmd(t.CSI.Style, t.Style.BrightBlack), `  ${locText}`] : []),
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
