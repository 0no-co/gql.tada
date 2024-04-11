import {
  pipe,
  interval,
  fromValue,
  fromAsyncIterable,
  switchMap,
  concat,
  delay,
  map,
  scan,
} from 'wonka';

import * as t from '../term';
export { error } from '../term';

const clearLine = () => t.cmd(t.CSI.DeleteLines, 1) + t.cmd(t.CSI.ToColumn, 1);

function printTitle(title: string) {
  return fromValue(
    t.text([
      t.cmd(t.CSI.Style, t.Style.BrightBlack),
      t.HeavyBox.TopLeft,
      ' ',
      t.cmd(t.CSI.Style, [t.Style.Magenta, t.Style.Invert]),
      ` ${title.trim()} `,
      t.cmd(t.CSI.Style, t.Style.Reset),
      '\n',
    ])
  );
}

function printLine(text?: string) {
  let out = t.text([t.cmd(t.CSI.Style, t.Style.BrightBlack), t.HeavyBox.Vertical]);
  if (text) out += t.text` ${text}\n${t.HeavyBox.Vertical}`;
  out += t.text([t.cmd(t.CSI.Style, t.Style.Reset), '\n']);
  return fromValue(out);
}

function printCompletedTask(description: string, isLast = false) {
  return fromValue(
    t.text([
      t.cmd(t.CSI.Style, t.Style.BrightBlack),
      isLast ? t.HeavyBox.BottomLeft : t.HeavyBox.VerticalRight,
      ' ',
      t.cmd(t.CSI.Style, t.Style.Green),
      t.Icons.TickSwoosh,
      ' ',
      t.cmd(t.CSI.Style, t.Style.Foreground),
      description,
      t.cmd(t.CSI.Style, t.Style.Reset),
      '\n',
    ])
  );
}

function printFailedTask(description: string) {
  return fromValue(
    t.text([
      t.cmd(t.CSI.Style, t.Style.BrightBlack),
      t.HeavyBox.BottomLeft,
      ' ',
      t.cmd(t.CSI.Style, t.Style.BrightRed),
      t.Icons.CrossSwoosh,
      ' ',
      t.cmd(t.CSI.Style, t.Style.Foreground),
      description,
      t.cmd(t.CSI.Style, t.Style.Reset),
      '\n',
    ])
  );
}

function printRunningTask(description: string) {
  return pipe(
    interval(150),
    map((state) =>
      t.text([
        clearLine(),
        t.cmd(t.CSI.Style, t.Style.Magenta),
        t.circleSpinner[state % t.circleSpinner.length],
        ' ',
        t.cmd(t.CSI.Style, t.Style.Foreground),
        description,
        t.cmd(t.CSI.Style, t.Style.Reset),
      ])
    )
  );
}

function printSuccess() {
  return fromValue(
    t.text([
      t.Chars.Newline,
      t.cmd(t.CSI.Style, [t.Style.Green, t.Style.Invert]),
      ' Done ',
      t.cmd(t.CSI.Style, t.Style.NoInvert),
      t.Chars.Space,
      'You are all set and ready to go.',
    ])
  );
}

function printError(error: Error) {
  if (error instanceof t.CLIError) {
    return fromValue(
      t.text([
        t.Chars.Newline,
        t.cmd(t.CSI.Style, [t.Style.BrightRed, t.Style.Invert]),
        ' Error ',
        t.cmd(t.CSI.Style, t.Style.NoInvert),
        t.Chars.Newline,
        `${error.output}`,
      ])
    );
  } else {
    return fromValue(
      t.text([
        t.Chars.Newline,
        t.cmd(t.CSI.Style, [t.Style.BrightRed, t.Style.Invert]),
        ' Unexpected Error ',
        t.cmd(t.CSI.Style, t.Style.NoInvert),
        t.Chars.Newline,
        `${error}`,
      ])
    );
  }
}

async function* printTask(task: () => AsyncIterable<PrintSignal>): AsyncIterable<PrintSignal> {
  try {
    for await (const signal of task()) {
      yield signal;
      if (signal.kind && signal.kind !== 'update') return;
    }
    yield { kind: 'complete' };
  } catch (error: any) {
    yield { kind: 'error', error };
  }
}

type PrintSignal =
  | { kind: 'complete' }
  | { kind: 'error'; error: Error }
  | { kind?: 'update'; text: string };

interface PrintState {
  prev: { kind?: 'update'; text: string } | null;
  task: PrintSignal;
}

interface PrintConfig {
  title: string;
  description?: string;
  task(): AsyncIterable<PrintSignal>;
}

export async function print(config: PrintConfig) {
  const tty = t.initTTY();

  const print = concat([
    printTitle(config.title),
    printLine(config.description),
    pipe(
      fromAsyncIterable(printTask(config.task)),
      delay(700),
      scan((state: PrintState, task) => ({ task, prev: state.task as PrintState['prev'] }), {
        prev: null,
        task: null,
      } as any),
      switchMap(({ prev, task }) => {
        const sources = [fromValue(clearLine())];
        if (task.kind === 'complete') {
          if (prev) sources.push(printCompletedTask(prev.text, true));
          sources.push(printSuccess());
        } else if (task.kind === 'error') {
          if (prev) sources.push(printFailedTask(prev.text));
          sources.push(printError(task.error));
        } else {
          if (prev) sources.push(printCompletedTask(prev.text));
          sources.push(printRunningTask(task.text));
        }
        return concat(sources);
      })
    ),
  ]);

  return await tty.pipeOutput(print);
}
