import { pipe, interval, map, concat, fromValue } from 'wonka';

import * as path from 'node:path';
import * as t from '../../term';

import type { ScanWarning } from './types';
import { indent } from '../shared/logger';

export * from '../shared/logger';

const CWD = process.cwd();
const INDENT = '  ';

export function warningFile(filePath: string) {
  const relativePath = path.relative(CWD, filePath);
  if (!relativePath.startsWith('..')) filePath = relativePath;
  return t.text([
    t.cmd(t.CSI.Style, t.Style.Underline),
    filePath,
    t.cmd(t.CSI.Style, t.Style.NoUnderline),
    '\n',
  ]);
}

export function warningMessage(message: ScanWarning) {
  return t.text([
    INDENT,
    t.cmd(t.CSI.Style, t.Style.BrightBlack),
    `${message.line}:${message.col}`,
    t.Chars.Tab,
    t.cmd(t.CSI.Style, t.Style.Foreground),
    indent(message.message.trim(), t.text([INDENT, t.Chars.Tab])),
    t.Chars.Newline,
  ]);
}

export function warningGithub(message: ScanWarning): void {
  t.githubAnnotation('warning', message.message, {
    file: message.file,
    line: message.line,
    col: message.col,
  });
}

export function runningScan(file?: number, ofFiles?: number) {
  const progress = file ? (ofFiles ? `(${file}/${ofFiles})` : `(${file})`) : '';
  const frame = (state: number) =>
    t.text([
      t.cmd(t.CSI.Style, t.Style.Magenta),
      t.dotSpinner[state % t.dotSpinner.length],
      ' ',
      t.cmd(t.CSI.Style, t.Style.Foreground),
      `Scanning files${t.Chars.Ellipsis} `,
      t.cmd(t.CSI.Style, t.Style.BrightBlack),
      progress,
    ]);
  return concat([
    fromValue(frame(0)),
    pipe(
      interval(150),
      map((state) => frame(state + 1))
    ),
  ]);
}

export function analysing() {
  return t.text([
    t.cmd(t.CSI.Style, t.Style.Magenta),
    `${t.dotSpinner[0]} `,
    t.cmd(t.CSI.Style, t.Style.Foreground),
    `Analysing documents${t.Chars.Ellipsis}`,
  ]);
}

export function summary(args: {
  warnings: number;
  operations: number;
  fragments: number;
  modules: number;
}) {
  let out = '';
  if (args.warnings) {
    out += t.text([
      t.cmd(t.CSI.Style, t.Style.BrightYellow),
      t.Icons.Warning,
      ` ${args.warnings} warnings\n`,
    ]);
  }
  out += t.text([
    t.cmd(t.CSI.Style, t.Style.BrightGreen),
    `${t.Icons.Tick} Scan completed `,
    t.cmd(t.CSI.Style, t.Style.BrightBlack),
    `(${args.operations} operations, ${args.fragments} fragments across ${args.modules} modules)\n`,
  ]);
  return out;
}

export function warningSummary(warningCount: number) {
  return t.error([t.cmd(t.CSI.Style, t.Style.Red), `${t.Icons.Cross} ${warningCount} warnings\n`]);
}

export function wroteOutput(label: string, filePath: string) {
  const relativePath = path.relative(CWD, filePath);
  return t.text([
    t.cmd(t.CSI.Style, t.Style.BrightBlack),
    `${t.HeavyBox.BottomLeft} `,
    t.cmd(t.CSI.Style, t.Style.BrightBlue),
    `Wrote ${label} to `,
    t.cmd(t.CSI.Style, t.Style.Blue),
    `${!relativePath.startsWith('..') ? relativePath : filePath}\n`,
  ]);
}
