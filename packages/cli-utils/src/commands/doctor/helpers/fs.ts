import * as fs from 'node:fs/promises';

export const enum FileType {
  File,
  Directory,
}

export const stat = async (file: string, type = FileType.File): Promise<boolean> =>
  await fs
    .stat(file)
    .then((stat) => {
      switch (type) {
        case FileType.File:
          return stat.isFile();
        case FileType.Directory:
          return stat.isDirectory();
      }
    })
    .catch(() => false);
