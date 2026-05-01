import { Cli } from 'clipanion';
import * as api from './api';

import { GenerateOutputCommand } from './commands/generate-output/index';
import { GenerateSchema } from './commands/generate-schema/index';
import { InitCommand } from './commands/init/index';

async function _main() {
  const cli = new Cli({
    binaryVersion: process.env.npm_package_version || '0.0.0',
    binaryLabel: 'gql.tada CLI',
    binaryName: 'gql.tada',
  });

  cli.register(GenerateOutputCommand);
  cli.register(GenerateSchema);
  cli.register(InitCommand);

  // The following commands require TypeScript's programmatic API.
  // When TypeScript is not available (e.g. `@typescript/native-preview`),
  // these commands are silently omitted and won't be registered.
  for (const [path, exportName] of [
    ['./commands/check/index.js', 'CheckCommand'],
    ['./commands/doctor/index.js', 'DoctorCommand'],
    ['./commands/generate-persisted/index.js', 'GeneratePersisted'],
    ['./commands/turbo/index.js', 'TurboCommand'],
  ] as const) {
    try {
      const mod = await import(path);
      cli.register(mod[exportName]);
    } catch {
      // TypeScript's programmatic API is not available.
      // This command requires it, so we skip registration.
    }
  }

  await cli.runExit(process.argv.slice(2));
}

type MainFn = typeof _main & typeof api;
const main = Object.assign(_main, api) as MainFn;

export * from './api';
export default main;
