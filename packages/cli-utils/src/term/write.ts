import { isTTY, output } from './tty';

export class CLIError extends Error {
  output: string;
  constructor(message: string) {
    super(stripAnsi(message));
    this.output = message;
  }
}

const ansiRegex = /([\x1B\x9B][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><])/g;
const stripAnsi = (input: string) => input.replace(ansiRegex, '');

let buffer = '';
let frame: any;

function flush() {
  if (frame != null) clearImmediate(frame);
  frame = null;
  output.write(buffer);
  buffer = '';
}

function writeRaw(input: string) {
  buffer += isTTY ? input : stripAnsi(input);
  if (frame == null) frame = setImmediate(flush);
}

function log(input: readonly string[], ...args: readonly string[]): void;
function log(input: string, ...args: readonly string[]): void;
function log(): void;

function log(input?: string | readonly string[], ...args: readonly string[]): void {
  if (!input) {
    flush();
  } else if (Array.isArray(input)) {
    let argIndex = 0;
    for (let index = 0; index < input.length; index++) {
      writeRaw(input[index]);
      if (argIndex < args.length) writeRaw(args[argIndex++]);
    }
  } else {
    writeRaw(input as string);
    for (const arg of args) writeRaw(arg);
  }
}

function error(input: readonly string[], ...args: readonly string[]): CLIError;
function error(input: string, ...args: readonly string[]): CLIError;

function error(input: string | readonly string[], ...args: readonly string[]): CLIError {
  let message = '';
  if (Array.isArray(input)) {
    let argIndex = 0;
    for (let index = 0; index < input.length; index++) {
      message += input[index];
      if (argIndex < args.length) message += args[argIndex++];
    }
  } else {
    message = input as string;
  }
  return new CLIError(message);
}

export { log, error };
