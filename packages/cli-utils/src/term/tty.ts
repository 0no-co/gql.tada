import type { WriteStream } from 'node:tty';
import { emitKeypressEvents } from 'node:readline';

import type { Source } from 'wonka';
import { make, pipe, share, takeLast, takeUntil, onPush, toPromise, map } from 'wonka';

import { cmd, _setColor, Mode, PrivateMode } from './csi';
import { text } from './write';

export interface KeypressEvent {
  text?: string;
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
  cancelSource: Source<void>;

  write(input: readonly string[], ...args: readonly string[]): void;
  write(...input: readonly string[]): void;

  pipeOutput(input: Source<string>): Promise<unknown>;

  mode(...modes: readonly (Mode | PrivateMode)[]): void;
  modeOff(...modes: readonly (Mode | PrivateMode)[]): void;
}

export function initTTY(): TTY {
  let isTTY = process.env.TERM !== 'dumb' && !process.env.CI;
  let pipeTo: WriteStream | null = null;
  let output: WriteStream = process.stdout;
  if (!output.isTTY && process.stderr.isTTY) {
    output = process.stderr;
    pipeTo = process.stdout;
  } else {
    isTTY = output.isTTY;
  }

  const hasColorArg = process.argv.includes('--color');
  const hasColorEnv = 'FORCE_COLOR' in process.env || (!process.env.NO_COLOR && !process.env.CI);

  _setColor((isTTY && hasColorEnv) || hasColorArg);
  emitKeypressEvents(process.stdin);

  const inputSource = pipe(
    make<KeypressEvent>((observer) => {
      if (isTTY) output.write(cmd(cmd.UnsetPrivateMode, PrivateMode.ShowCursor));
      if (process.stdin.isTTY) process.stdin.setRawMode(true);

      let isEnding = false;
      const onEnd = () => {
        if (!isEnding) {
          isEnding = true;
          if (isTTY)
            output.write(
              cmd(cmd.Reset) +
                cmd(cmd.ResetPrivateMode) +
                cmd(cmd.SetPrivateMode, PrivateMode.ShowCursor)
            );
          if (process.stdin.isTTY) process.stdin.setRawMode(false);
          observer.complete();
        }
      };

      const onKeypress = (text: string | undefined, event: KeypressEvent) => {
        if (
          (event.ctrl && (event.name === 'x' || event.name === 'c' || event.name === 'd')) ||
          event.name === 'escape'
        ) {
          observer.complete();
        } else if (!isEnding) {
          observer.next({ ...event, text });
        }
      };

      process.stdin.on('keypress', onKeypress);
      process.stdin.on('end', onEnd);
      process.on('SIGKILL', onEnd);
      process.on('SIGINT', onEnd);
      process.on('SIGTERM', onEnd);
      process.on('exit', onEnd);

      return () => {
        process.stdin.off('keypress', onKeypress);
        process.stdin.off('end', onEnd);
        process.off('SIGKILL', onEnd);
        process.off('SIGINT', onEnd);
        process.off('SIGTERM', onEnd);
        process.off('exit', onEnd);
        onEnd();
      };
    }),
    share
  );

  const cancelSource = pipe(
    inputSource,
    takeLast(1),
    map(() => undefined)
  );

  function write() {
    // eslint-disable-next-line prefer-rest-params
    output.write(text.apply(arguments));
  }

  const mode = (...modes: readonly (Mode | PrivateMode)[]): void => {
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
      if (normalModes.length) output.write(cmd(cmd.SetMode, normalModes));
      if (privateModes.length) output.write(cmd(cmd.SetPrivateMode, privateModes));
    }
  };

  const pipeOutput = (input: Source<string>) =>
    pipe(input, onPush(write), takeUntil(cancelSource), toPromise);

  const modeOff = (...modes: readonly (Mode | PrivateMode)[]): void => {
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
      if (normalModes.length) output.write(cmd(cmd.UnsetMode, normalModes));
      if (privateModes.length) output.write(cmd(cmd.UnsetPrivateMode, privateModes));
    }
  };

  return {
    output,
    pipeTo,
    inputSource,
    cancelSource,
    write,
    pipeOutput,
    mode,
    modeOff,
  };
}
