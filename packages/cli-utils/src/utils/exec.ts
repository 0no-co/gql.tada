import { text } from 'node:stream/consumers';
import { spawn } from 'node:child_process';

const TIMEOUT = 15;

export async function exec(command: string, args: string[]): Promise<string> {
  const child = spawn(command, args, {
    env: {
      ...process.env,
      COLOR: '0',
      CI: '1',
    },
    cwd: process.cwd(),
    windowsHide: true,
    shell: true,
    timeout: TIMEOUT * 1000,
    stdio: 'pipe',
  });

  const stdout = text(child.stdout);
  const stderr = text(child.stderr);
  const code = await new Promise<number | null>((resolve, reject) => {
    child.on('exit', (code: number | null) => resolve(code));
    child.on('error', (error: Error) => reject(error));
  });

  if (code == null) {
    throw new Error(`Command '${command}' has timed out (${TIMEOUT}s)`);
  } else if (code !== 0) {
    throw new Error(await stderr);
  } else {
    return await stdout;
  }
}
