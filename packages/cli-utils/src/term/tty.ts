import {
  fromValue,
  make,
  concat,
  pipe,
  filter,
  share,
  takeUntil,
  toPromise,
  onPush,
  onStart,
  onEnd,
} from 'wonka';

import type { Source } from 'wonka';
import type { WriteStream, ReadStream } from 'node:tty';
import { emitKeypressEvents } from 'node:readline';

import type { ComposeInput, CLIError } from './write';
import { text, compose } from './write';
import { cmd, _setColor, CSI, Mode, PrivateMode } from './csi';
import { isGithubCI } from './github';

export interface KeypressEvent {
  data?: string;
  sequence: string;
  name: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
}

export interface TTY {
  output: WriteStream;
  pipeTo: WriteStream | null;
  inputSource: Source<KeypressEvent>;
  cancelSource: Source<unknown>;

  write(input: readonly string[], ...args: readonly string[]): void;
  write(...input: readonly string[]): void;

  start(outputs: AsyncIterable<ComposeInput>): Promise<string | CLIError>;

  mode(...modes: readonly (Mode | PrivateMode)[]): void;
  modeOff(...modes: readonly (Mode | PrivateMode)[]): void;
}

function fromReadStream(stream: ReadStream): Source<KeypressEvent> {
  return make((observer) => {
    function onKeypress(data: string | undefined, event: KeypressEvent) {
      switch (event.name) {
        case 'c':
        case 'd':
        case 'x':
          if (event.ctrl) cleanup();
        case 'escape':
          cleanup();
        default:
          observer.next({ ...event, data });
      }
    }

    function cleanup() {
      observer.complete();
      stream.removeListener('keypress', onKeypress);
      stream.setRawMode(false);
      stream.unref();
    }

    emitKeypressEvents(stream);
    stream.setRawMode(true);
    stream.setEncoding('utf8');
    stream.resume();
    stream.addListener('keypress', onKeypress);
    return cleanup;
  });
}

export function initTTY(): TTY {
  let isTTY = process.env.TERM !== 'dumb' && !process.env.CI;
  let pipeTo: WriteStream | null = null;
  let output: WriteStream = process.stdout;
  if (isGithubCI) {
    output = process.stderr;
    if (!output.isTTY) pipeTo = process.stdout;
  } else if (!output.isTTY && process.stderr.isTTY) {
    output = process.stderr;
    pipeTo = process.stdout;
  } else {
    isTTY = output.isTTY;
  }

  const hasColorArg = process.argv.includes('--color');
  const hasColorEnv = 'FORCE_COLOR' in process.env || (!process.env.NO_COLOR && !process.env.CI);
  _setColor((isTTY && hasColorEnv) || hasColorArg || isGithubCI);

  function _start() {
    _setColor((isTTY && hasColorEnv) || hasColorArg);
    if (isTTY) {
      output.write(cmd(CSI.UnsetPrivateMode, PrivateMode.ShowCursor));
    }
  }

  function _end() {
    if (isTTY) {
      output.write(
        cmd(CSI.Reset) +
          cmd(CSI.ResetPrivateMode) +
          cmd(CSI.SetPrivateMode, PrivateMode.ShowCursor) +
          '\n'
      );
    }
  }

  const inputSource = pipe(fromReadStream(process.stdin), onStart(_start), onEnd(_end), share);

  const cancelSource = pipe(
    concat([
      pipe(
        inputSource,
        filter(() => false)
      ),
      fromValue(null),
    ]),
    share
  );

  function write(...input: any[]) {
    output.write(text(...input));
  }

  function start(outputs: AsyncIterable<ComposeInput>): Promise<string | CLIError> {
    const write = (input: string | CLIError) => output.write('' + input);
    return pipe(compose(outputs), onPush(write), takeUntil(cancelSource), toPromise);
  }

  function mode(...modes: readonly (Mode | PrivateMode)[]): void {
    if (isTTY) {
      const normalModes: Mode[] = [];
      const privateModes: PrivateMode[] = [];
      for (const mode of modes) {
        if (mode === Mode.Insert || mode === Mode.AutomaticNewline) {
          normalModes.push(mode);
        } else {
          privateModes.push(mode);
        }
      }
      if (normalModes.length) output.write(cmd(CSI.SetMode, normalModes));
      if (privateModes.length) output.write(cmd(CSI.SetPrivateMode, privateModes));
    }
  }

  function modeOff(...modes: readonly (Mode | PrivateMode)[]): void {
    if (isTTY) {
      const normalModes: Mode[] = [];
      const privateModes: PrivateMode[] = [];
      for (const mode of modes) {
        if (mode === Mode.Insert || mode === Mode.AutomaticNewline) {
          normalModes.push(mode);
        } else {
          privateModes.push(mode);
        }
      }
      if (normalModes.length) output.write(cmd(CSI.UnsetMode, normalModes));
      if (privateModes.length) output.write(cmd(CSI.UnsetPrivateMode, privateModes));
    }
  }

  return {
    output,
    pipeTo,
    inputSource,
    cancelSource,
    write,
    start,
    mode,
    modeOff,
  };
}
