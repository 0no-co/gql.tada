import { pipe, interval, map } from 'wonka';

import * as t from '../../term';
import { indent } from '../shared/logger';

export * from '../shared/logger';

export function console(error: any) {
  return t.text([
    t.cmd(t.CSI.Style, t.Style.BrightBlack),
    `${t.HeavyBox.BottomLeft} `,
    error && error instanceof Error ? error.message : `${error}`,
  ]);
}

export function sampleCode(code: string) {
  return t.text([
    ' ',
    t.cmd(t.CSI.Style, t.Style.BrightWhite),
    indent(code, ' ' + t.cmd(t.CSI.Style, t.Style.BrightWhite)),
  ]);
}

export function emptyLine() {
  return t.text([t.cmd(t.CSI.Style, t.Style.BrightBlack), t.HeavyBox.Vertical, '\n']);
}

export function title(title: string, description?: string) {
  let out = t.text([
    t.cmd(t.CSI.Style, t.Style.BrightBlack),
    t.HeavyBox.TopLeft,
    ' ',
    t.cmd(t.CSI.Style, [t.Style.Magenta, t.Style.Invert]),
    ` ${title.trim()} `,
    t.cmd(t.CSI.Style, [t.Style.NoInvert]),
    '\n',
  ]);
  if (description) {
    out += t.text([
      t.cmd(t.CSI.Style, t.Style.BrightBlack),
      t.HeavyBox.Vertical,
      ` ${description}\n`,
    ]);
  }
  return out;
}

export function completedTask(description: string, isLast = false) {
  return t.text([
    emptyLine(),
    t.cmd(t.CSI.Style, t.Style.BrightBlack),
    isLast ? t.HeavyBox.BottomLeft : t.HeavyBox.VerticalRight,
    ' ',
    t.cmd(t.CSI.Style, t.Style.Green),
    t.Icons.TickSwoosh,
    ' ',
    t.cmd(t.CSI.Style, t.Style.Foreground),
    description,
    '\n',
  ]);
}

export function failedTask(description: string) {
  return t.text([
    emptyLine(),
    t.cmd(t.CSI.Style, t.Style.BrightBlack),
    t.HeavyBox.BottomLeft,
    ' ',
    t.cmd(t.CSI.Style, t.Style.BrightRed),
    t.Icons.CrossSwoosh,
    ' ',
    t.cmd(t.CSI.Style, t.Style.Foreground),
    description,
    '\n',
  ]);
}

export function warningTask(description: string) {
  return t.text([
    emptyLine(),
    t.cmd(t.CSI.Style, t.Style.BrightBlack),
    t.HeavyBox.VerticalRight,
    ' ',
    t.cmd(t.CSI.Style, t.Style.BrightYellow),
    t.Icons.Warning,
    ' ',
    t.cmd(t.CSI.Style, t.Style.Foreground),
    description,
    '\n',
  ]);
}

export function hintMessage(text: string) {
  return t.text([
    t.cmd(t.CSI.Style, t.Style.BrightBlack),
    `${t.HeavyBox.VerticalRight} `,
    t.cmd(t.CSI.Style, t.Style.BrightBlue),
    `${t.Icons.Info} `,
    t.cmd(t.CSI.Style, t.Style.Blue),
    indent(
      text,
      t.text([
        t.cmd(t.CSI.Style, t.Style.BrightBlack),
        `${t.HeavyBox.Vertical}   `,
        t.cmd(t.CSI.Style, t.Style.Blue),
      ])
    ),
  ]);
}

export function runningTask(description: string) {
  return pipe(
    interval(150),
    map((state) => {
      return t.text([
        emptyLine(),
        t.cmd(t.CSI.Style, t.Style.Magenta),
        t.circleSpinner[state % t.circleSpinner.length],
        ' ',
        t.cmd(t.CSI.Style, t.Style.Foreground),
        description.trim(),
      ]);
    })
  );
}

export function success() {
  return t.text([
    '\n',
    t.cmd(t.CSI.Style, [t.Style.Green, t.Style.Invert]),
    ' Done ',
    t.cmd(t.CSI.Style, t.Style.NoInvert),
    t.Chars.Space,
    'You are all set and ready to go.\n',
  ]);
}

export function errorMessage(message: string) {
  return t.error([
    '\n',
    t.cmd(t.CSI.Style, [t.Style.Red, t.Style.Invert]),
    ` ${t.Icons.Warning} Error `,
    t.cmd(t.CSI.Style, t.Style.NoInvert),
    `\n${message.trim()}\n`,
  ]);
}
