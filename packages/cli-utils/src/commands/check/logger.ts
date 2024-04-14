import * as t from '../../term';
import type { DiagnosticMessage } from './types';

export function diagnosticFile(filePath: string, messages: DiagnosticMessage[]) {
  let output = t.text([
    t.cmd(t.CSI.Style, t.Style.Underline),
    filePath,
    t.cmd(t.CSI.Style, t.Style.NoUnderline),
    '\n',
  ]);
  for (const message of messages) output += diagnosticMessage(message);
  output += '\n';
  return output;
}

export function diagnosticMessage(message: DiagnosticMessage) {
  const indent = t.Chars.Space.repeat(2);

  let color = t.Style.Foreground;
  if (message.severity === 'info') {
    color = t.Style.BrightBlue;
  } else if (message.severity === 'warn') {
    color = t.Style.BrightYellow;
  } else if (message.severity === 'error') {
    color = t.Style.BrightRed;
  }

  let text = message.message.trim();
  if (text.includes('\n')) {
    text = text.split('\n').join(t.text([t.Chars.Newline, indent, t.Chars.Tab, t.Chars.Tab]));
  }

  return t.text([
    indent,
    t.cmd(t.CSI.Style, t.Style.BrightBlack),
    `${message.line}:${message.col}`,
    t.Chars.Tab,
    t.cmd(t.CSI.Style, color),
    message.severity,
    t.Chars.Tab,
    t.cmd(t.CSI.Style, t.Style.Foreground),
    text,
    t.Chars.Newline,
  ]);
}
