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

export interface TTYParams {
  disableTTY?: boolean;
  silent?: boolean;
}

export interface KeypressEvent {
  data?: string;
  sequence: string;
  name: string;
  ctrl: boolean;
  meta: boolean;
  shift: boolean;
}

export interface TTY {
  isInteractive: boolean;

  output: WriteStream;
  pipeTo: WriteStream | null;
  inputSource: Source<KeypressEvent>;
  cancelSource: Source<unknown>;

  write(input: readonly string[], ...args: readonly string[]): void;
  write(...input: readonly string[]): void;

  start(outputs: AsyncIterable<ComposeInput>, disableInput?: boolean): Promise<string | CLIError>;

  mode(...modes: readonly (Mode | PrivateMode)[]): void;
  modeOff(...modes: readonly (Mode | PrivateMode)[]): void;
}

function fromReadStream(stream: ReadStream, onTerminate: () => void): Source<KeypressEvent> {
  return make((observer) => {
    function onKeypress(data: string | undefined, event: KeypressEvent) {
      switch (event.name) {
        case 'c':
        case 'd':
        case 'x':
          if (event.ctrl) return onTerminate();
          break;
        case 'escape':
          return cleanup();
      }
      observer.next({ ...event, data });
    }

    function cleanup() {
      try {
        if (stream.isTTY) stream.setRawMode(false);
        stream.removeListener('keypress', onKeypress);
        if (typeof stream.unref === 'function') {
          stream.unref();
        }
      } catch {
        // noop
      } finally {
        observer.complete();
      }
    }

    if (stream.isTTY) stream.setRawMode(true);
    emitKeypressEvents(stream);
    stream.setEncoding('utf8');
    stream.resume();
    stream.addListener('keypress', onKeypress);
    return cleanup;
  });
}

export function initTTY(params: TTYParams = {}): TTY {
  let isTTY = process.env.TERM !== 'dumb' && !process.env.CI && !params.disableTTY;
  let pipeTo: WriteStream | null = null;
  let output: WriteStream = process.stdout;
  if (isGithubCI) {
    output = process.stderr;
  } else if (!output.isTTY && process.stderr.isTTY) {
    output = process.stderr;
    pipeTo = process.stdout;
  } else {
    isTTY = output.isTTY;
  }

  const hasColorArg = process.argv.includes('--color');
  const hasColorEnv = 'FORCE_COLOR' in process.env || (!process.env.NO_COLOR && !process.env.CI);
  _setColor((isTTY && hasColorEnv) || hasColorArg || isGithubCI);

  function _restore() {
    if (process.stdin.isTTY) process.stdin.setRawMode(false);
    output.write(
      cmd(CSI.Reset) + cmd(CSI.ResetPrivateMode) + cmd(CSI.SetPrivateMode, PrivateMode.ShowCursor)
    );
  }

  function _terminate(code: number) {
    _restore();
    process.exit(code);
  }

  function _signal(signal: NodeJS.Signals) {
    _terminate(signal === 'SIGINT' ? 130 : 143);
  }

  function _start() {
    _setColor((isTTY && hasColorEnv) || hasColorArg);
    if (isTTY) {
      output.write(cmd(CSI.UnsetPrivateMode, PrivateMode.ShowCursor));
      process.on('SIGINT', _signal);
      process.on('SIGTERM', _signal);
    }
  }

  function _end() {
    if (isTTY) {
      process.removeListener('SIGINT', _signal);
      process.removeListener('SIGTERM', _signal);
      output.write(
        cmd(CSI.Reset) + cmd(CSI.ResetPrivateMode) + cmd(CSI.SetPrivateMode, PrivateMode.ShowCursor)
      );
    }
  }

  const inputSource = pipe(
    fromReadStream(process.stdin, () => _terminate(130)),
    onStart(_start),
    onEnd(_end),
    share
  );

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
    if (!params.silent) output.write(text(...input));
  }

  function start(outputs: AsyncIterable<ComposeInput>): Promise<string | CLIError> {
    const write = (input: string | CLIError) => {
      if (!params.silent) output.write('' + input);
    };
    if (params.disableTTY) {
      return pipe(compose(outputs), onPush(write), toPromise);
    } else {
      return pipe(compose(outputs), onPush(write), takeUntil(cancelSource), toPromise);
    }
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
    isInteractive: isTTY,
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
