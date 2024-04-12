import type { Source } from 'wonka';

import {
  pipe,
  fromAsyncIterable,
  fromValue,
  concatMap,
  sample,
  merge,
  takeUntil,
  filter,
  share,
  take,
  scan,
  map,
} from 'wonka';

import { cmd, CSI, Style } from './csi';

const ansiRegex = /([\x1B\x9B][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><])/g;

export const stripAnsi = (input: string) => input.replace(ansiRegex, '');

export class CLIError extends Error {
  output: string;
  constructor(message: string) {
    super(stripAnsi(message));
    this.output = message;
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
function error(...input: readonly string[]): CLIError;

function error(...input: any[]): CLIError {
  return new CLIError(text(...input));
}

function clear(text: string) {
  if (!text) return '';
  let lines = 0;
  for (let index = 0; index < text.length; index++)
    if (text.charCodeAt(index) === 10 /*'\n'*/) lines++;
  return (lines > 0 ? cmd(CSI.PrevLine, lines) : '') + cmd(CSI.DeleteLines, lines + 1);
}

type ComposeInput = undefined | string | Source<string> | AsyncIterable<ComposeInput>;

async function* convertError(outputs: AsyncIterable<ComposeInput>): AsyncIterable<ComposeInput> {
  try {
    yield* outputs;
  } catch (error) {
    yield error instanceof CLIError ? error.output : '' + error;
  }
}

function compose(outputs: AsyncIterable<ComposeInput>): Source<string> {
  const outputs$ = share(fromAsyncIterable(convertError(outputs)));
  const reset = cmd(CSI.Style, [Style.Reset, Style.NoInvert]);
  return pipe(
    outputs$,
    filter(<T>(x: T): x is Exclude<T, undefined> => x != null),
    concatMap((output) => {
      if (typeof output === 'object') {
        return compose(output);
      }
      const output$ = share(typeof output === 'string' ? fromValue(output) : output);
      return pipe(
        merge([
          pipe(
            output$,
            sample(outputs$),
            map((output) => (output.endsWith('\n') ? output : '')),
            take(1)
          ),
          pipe(output$, takeUntil(outputs$)),
        ]),
        scan((prev, output) => clear(prev) + output + reset, '')
      );
    })
  );
}

export type { ComposeInput };
export { text, error, compose, clear };
