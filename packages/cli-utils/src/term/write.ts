import type { Source } from 'wonka';

import {
  pipe,
  fromAsyncIterable,
  fromValue,
  concatMap,
  never,
  merge,
  takeUntil,
  takeLast,
  filter,
  share,
  scan,
  map,
} from 'wonka';

import { cmd, CSI, EraseLine, Style } from './csi';

const ansiRegex = /([\x1B\x9B][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><])/g;

export const stripAnsi = (input: string) => input.replace(ansiRegex, '');

export class CLIError extends Error {
  output: string;
  exit: number;
  constructor(message: string, exitCode?: number) {
    super(stripAnsi(message));
    this.output = message;
    this.exit = exitCode == null ? 0 : 1;
  }

  toString() {
    if (this.exit) process.exitCode = this.exit;
    return this.output;
  }
}

function text(input: readonly string[], ...args: readonly string[]): string;
function text(...input: readonly string[]): string;

function text(input: string | readonly string[], ...args: readonly string[]): string {
  let out = '';
  if (Array.isArray(input)) {
    let argIndex = 0;
    for (let index = 0; index < input.length; index++) {
      out += input[index];
      if (argIndex < args.length) out += args[argIndex++];
    }
  } else if (typeof input === 'string') {
    out += input;
    for (const arg of args) out += arg;
  }
  return out;
}

function error(input: readonly string[], ...args: readonly string[]): CLIError;
function error(arg: string | number, ...input: readonly string[]): CLIError;
function error(...input: readonly string[]): CLIError;

function error(arg: readonly string[] | string | number, ...input: readonly string[]): CLIError {
  return typeof arg === 'number'
    ? new CLIError(text(...input), arg)
    : new CLIError(text(arg as string, ...input));
}

function clear(text: string) {
  let lines = 0;
  for (let index = 0; index < text.length; index++)
    if (text.charCodeAt(index) === 10 /*'\n'*/) lines++;
  if (lines) {
    return cmd(CSI.PrevLine, lines) + cmd(CSI.DeleteLines, lines + 1);
  } else if (stripAnsi(text)) {
    return cmd(CSI.EraseLine, EraseLine.Backward), cmd(CSI.ToColumn, 1);
  } else {
    return '';
  }
}

type ComposeInput = undefined | string | CLIError | Source<string> | AsyncIterable<ComposeInput>;

async function* convertError(outputs: AsyncIterable<ComposeInput>): AsyncIterable<ComposeInput> {
  try {
    yield* outputs;
  } catch (error) {
    yield error instanceof CLIError ? error : '' + error;
  }
}

function compose(outputs: AsyncIterable<ComposeInput>): Source<string | CLIError> {
  const reset = cmd(CSI.Style, [Style.Reset, Style.NoInvert]);
  const outputs$ = pipe(
    fromAsyncIterable(convertError(outputs)),
    concatMap((output) => {
      return typeof output === 'object' && !(output instanceof CLIError)
        ? compose(output)
        : fromValue(output);
    }),
    filter(<T>(x: T): x is Exclude<T, undefined> => x != null),
    share
  );

  return pipe(
    outputs$,
    concatMap((output) => {
      const output$ = pipe(
        typeof output === 'string' || output instanceof CLIError
          ? fromValue(output)
          : merge([output, never]),
        takeUntil(outputs$),
        share
      );
      return pipe(
        merge([
          pipe(
            output$,
            takeLast(1),
            map((output) => (typeof output === 'string' && !output.endsWith('\n') ? '' : output))
          ),
          output$,
        ]),
        scan((prev: CLIError | string, output) => {
          return typeof output === 'string'
            ? clear(typeof prev === 'string' ? prev : '') + output + reset
            : output;
        }, '')
      );
    }),
    takeUntil(pipe(outputs$, takeLast(1)))
  );
}

export type { ComposeInput };
export { text, error, compose, clear };
