import * as t from '../../term';

export function indent(text: string, indent: string) {
  if (text.includes('\n')) {
    return text.split('\n').join(t.text([t.Chars.Newline, indent]));
  } else {
    return text;
  }
}

export function code(text: string) {
  return t.text`${t.cmd(t.CSI.Style, t.Style.Underline)}${text}${t.cmd(
    t.CSI.Style,
    t.Style.NoUnderline
  )}`;
}

export function bold(text: string) {
  return t.text`${t.cmd(t.CSI.Style, t.Style.Bold)}${text}${t.cmd(t.CSI.Style, t.Style.Normal)}`;
}

export function hint(text: string) {
  return t.text([
    t.cmd(t.CSI.Style, t.Style.BrightBlack),
    `${t.HeavyBox.BottomLeft} `,
    t.cmd(t.CSI.Style, t.Style.BrightBlue),
    `${t.Icons.Info} `,
    t.cmd(t.CSI.Style, t.Style.Blue),
    indent(text, '    '),
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

export function externalError(message: string, error: unknown) {
  let title: string;
  let text: string;
  if (error && typeof error === 'object') {
    if (
      'name' in error &&
      (error.name === 'TSError' || error.name === 'TadaError' || 'code' in error)
    ) {
      title = 'code' in error ? 'System Error' : 'Error';
      text = (error as Error).message.trim();
    } else if ('message' in error && typeof error.message === 'string') {
      title = 'Unexpected Error';
      text = `${error.message}`;
    } else {
      title = 'Unexpected Error';
      text = `${error}`;
    }
  } else {
    title = 'Unexpected Error';
    text = `${error}`;
  }

  return t.error([
    '\n',
    t.cmd(t.CSI.Style, [t.Style.Red, t.Style.Invert]),
    ` ${t.Icons.Warning} ${title} `,
    t.cmd(t.CSI.Style, t.Style.NoInvert),
    `\n${message.trim()}\n`,
    t.cmd(t.CSI.Style, t.Style.BrightBlack),
    `${t.HeavyBox.BottomLeft} `,
    indent(text, '  '),
  ]);
}