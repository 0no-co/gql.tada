import * as path from 'node:path';

import type { TTY } from '../../term';
import { CLIError } from '../../term';
import type { WriteTarget } from './utils';
import { writeOutput } from './utils';

/** Version of the common envelope used by machine-readable command output. */
export const MACHINE_SCHEMA_VERSION = 1 as const;

export interface MachineError {
  name: string;
  message: string;
  exitCode: number;
}

export function toMachineError(error: unknown, exitCode = 1): MachineError {
  if (error instanceof CLIError) {
    return {
      name: error.name,
      message: error.message.trim(),
      exitCode: error.exit,
    };
  }
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message.trim(),
      exitCode,
    };
  }
  return {
    name: 'Error',
    message: String(error).trim(),
    exitCode,
  };
}

export function machineDestination(tty: TTY, output: string | undefined): WriteTarget {
  return output ? path.resolve(process.cwd(), output) : (tty.pipeTo ?? process.stdout);
}

export async function writeMachineOutput(
  tty: TTY,
  output: string | undefined,
  report: unknown
): Promise<void> {
  await writeOutput(machineDestination(tty, output), JSON.stringify(report, null, 2) + '\n');
}

/** Makes absolute project paths stable and readable while preserving paths outside cwd. */
export function displayPath(filePath: string, basePath = process.cwd()): string {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.resolve(basePath, filePath);
  const relative = path.relative(basePath, absolutePath);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative)
    ? relative
    : absolutePath;
}
