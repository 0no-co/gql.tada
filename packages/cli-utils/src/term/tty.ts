import type { WriteStream } from 'node:tty';
import { cmd, PrivateMode } from './csi';

export let isTTY = process.env.TERM !== 'dumb' && !process.env.CI;
export let pipe: WriteStream | null = null;
export let output: WriteStream = process.stdout;
if (!output.isTTY && process.stderr.isTTY) {
  output = process.stderr;
  pipe = process.stdout;
} else {
  isTTY = output.isTTY;
}

const hasColorArg = process.argv.includes('--color');
const hasColorEnv = process.env.FORCE_COLOR || (!process.env.NO_COLOR && !process.env.CI);
export const hasColor = (isTTY && hasColorEnv) || hasColorArg;

export let columns = 0;
export let rows = 0;

export function init() {
  if (isTTY) {
    columns = output.columns;
    rows = output.rows;
    output.on('resize', () => {
      columns = output.columns;
      rows = output.rows;
    });

    process.stdin.setRawMode(true);
    output.write(cmd(cmd.UnsetPrivateMode, PrivateMode.ShowCursor));

    process.on('exit', () => {
      output.write(
        cmd(cmd.Reset) +
          cmd(cmd.ResetPrivateMode) +
          cmd(cmd.SetPrivateMode, PrivateMode.ShowCursor) +
          '\n'
      );
    });
  }
}
