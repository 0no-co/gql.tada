import type { WriteStream } from 'node:tty';
import type { PathLike } from 'node:fs';
import { dirname } from 'node:path';
import * as fs from 'node:fs/promises';

/** Checks whether a directory exists on disk */
const directoryExists = async (file: PathLike): Promise<boolean> => {
  try {
    const stat = await fs.stat(file);
    if (stat.isDirectory()) {
      return true;
    } else if (stat.isSymbolicLink()) {
      return directoryExists(await fs.realpath(file));
    } else {
      return false;
    }
  } catch {
    return false;
  }
};

/** Checks whether a file exists on disk */
const fileExists = (file: PathLike): Promise<boolean> =>
  fs
    .stat(file)
    .then((stat) => stat.isFile())
    .catch(() => false);

const touchFile = async (file: PathLike): Promise<void> => {
  try {
    const now = new Date();
    await fs.utimes(file, now, now);
  } catch (_error) {}
};

export type WriteTarget = PathLike | WriteStream;

/** Writes a file to a swapfile then moves it into place to prevent excess change events. */
export const writeOutput = async (target: WriteTarget, contents: string): Promise<void> => {
  if (target && typeof target === 'object' && 'writable' in target) {
    // If we get a WritableStream (e.g. stdout), we write to that
    // but we listen for errors and wait for it to flush fully
    return await new Promise((resolve, reject) => {
      target.write(contents, (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  const targetDirectory = dirname(typeof target !== 'string' ? await fs.realpath(target) : target);
  if (!(await directoryExists(targetDirectory))) {
    await fs.mkdir(targetDirectory, { recursive: true });
  }

  if (!(await fileExists(target))) {
    // If the file doesn't exist, we can write directly, and not
    // try-catch so the error falls through
    await fs.writeFile(target, contents);
  } else {
    // If the file exists, we write to a swap-file, then rename (i.e. move)
    // the file into place. No try-catch around `writeFile` for proper
    // directory/permission errors
    const tempTarget = target + '.tmp';
    await fs.writeFile(tempTarget, contents);
    try {
      await fs.rename(tempTarget, target);
    } catch (error) {
      await fs.unlink(tempTarget);
      throw error;
    } finally {
      // When we move the file into place, we also update its access and
      // modification time manually, in case the rename doesn't trigger
      // a change event
      await touchFile(target);
    }
  }
};
