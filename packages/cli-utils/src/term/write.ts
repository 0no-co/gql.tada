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

function error(): CLIError {
  // eslint-disable-next-line prefer-rest-params
  return new CLIError(text.apply(arguments));
}

export { text, error };
