import { pipe, interval, map } from 'wonka';

import * as path from 'node:path';
import * as t from '../../term';
import type { DiagnosticMessage } from './types';
import type { SeveritySummary } from './types';

export * from '../shared/logger';
import { indent } from '../shared/logger';

const CWD = process.cwd();
const INDENT = '  ';

export function diagnosticFile(filePath: string) {
  const relativePath = path.relative(CWD, filePath);
  if (!relativePath.startsWith('..')) filePath = relativePath;
  return t.text([
    t.cmd(t.CSI.Style, t.Style.Underline),
    filePath,
    t.cmd(t.CSI.Style, t.Style.NoUnderline),
    '\n',
  ]);
}

export function diagnosticMessage(message: DiagnosticMessage) {
  let color = t.Style.Foreground;
  if (message.severity === 'info') {
    color = t.Style.BrightBlue;
  } else if (message.severity === 'warn') {
    color = t.Style.BrightYellow;
  } else if (message.severity === 'error') {
    color = t.Style.BrightRed;
  }

  return t.text([
    INDENT,
    t.cmd(t.CSI.Style, t.Style.BrightBlack),
    `${message.line}:${message.col}`,
    t.Chars.Tab,
    t.cmd(t.CSI.Style, color),
    message.severity,
    t.Chars.Tab,
    t.cmd(t.CSI.Style, t.Style.Foreground),
    indent(message.message.trim(), t.text([INDENT, t.Chars.Tab, t.Chars.Tab])),
    t.Chars.Newline,
  ]);
}

export function infoSummary(summary: SeveritySummary) {
  const { info, error, warn } = summary;
  let out = '';
  if (info) {
    out += t.text([t.cmd(t.CSI.Style, t.Style.Blue), t.Icons.Info, ` ${info} notices\n`]);
  }
  if (error || warn) {
    out += t.text([
      t.cmd(t.CSI.Style, t.Style.BrightYellow),
      t.Icons.Warning,
      ` ${error + warn} problems (${error} errors, ${warn} warnings)\n`,
    ]);
  } else {
    out += t.text([t.cmd(t.CSI.Style, t.Style.BrightGreen), t.Icons.Tick, ` No problems found\n`]);
  }
  return out;
}

export function problemsSummary(summary: SeveritySummary) {
  const { info, error, warn } = summary;
  let out = '';
  if (info) {
    out += t.text([t.cmd(t.CSI.Style, t.Style.Blue), t.Icons.Info, ` ${info} notices\n`]);
  }
  out += t.text([
    t.cmd(t.CSI.Style, t.Style.Red),
    t.Icons.Cross,
    ` ${error + warn} problems (${error} errors, ${warn} warnings)\n`,
  ]);
  return t.error(out);
}

export function diagnosticMessageGithub(message: DiagnosticMessage): void {
  const kind =
    message.severity === 'warn' ? 'warning' : message.severity === 'error' ? 'error' : 'notice';
  t.githubAnnotation(kind, message.message, {
    file: message.file,
    line: message.line,
    col: message.col,
    endLine: message.endLine,
    endColumn: message.endColumn,
  });
}

export function runningDiagnostics(file: number, ofFiles?: number) {
  const progress = ofFiles ? `(${file}/${ofFiles})` : `(${file})`;
  return pipe(
    interval(150),
    map((state) => {
      return t.text([
        t.cmd(t.CSI.Style, t.Style.Magenta),
        t.dotSpinner[state % t.dotSpinner.length],
        ' ',
        t.cmd(t.CSI.Style, t.Style.Foreground),
        `Checking files${t.Chars.Ellipsis} `,
        t.cmd(t.CSI.Style, t.Style.BrightBlack),
        progress,
      ]);
    })
  );
}
