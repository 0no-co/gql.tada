import { Cli } from 'clipanion';

import { CheckCommand } from './commands/check/index';
import { DoctorCommand } from './commands/doctor/index';
import { GenerateOutputCommand } from './commands/generate-output/index';
import { GeneratePersisted } from './commands/generate-persisted/index';
import { GenerateSchema } from './commands/generate-schema/index';
import { InitCommand } from './commands/init/index';
import { TurboCommand } from './commands/turbo/index';

function main() {
  const cli = new Cli({
    binaryVersion: process.env.npm_package_version || '0.0.0',
    binaryLabel: 'gql.tada CLI',
    binaryName: 'gql.tada',
  });

  cli.register(CheckCommand);
  cli.register(DoctorCommand);
  cli.register(GenerateOutputCommand);
  cli.register(GeneratePersisted);
  cli.register(GenerateSchema);
  cli.register(InitCommand);
  cli.register(TurboCommand);

  cli.runExit(process.argv.slice(2));
}

export default main;
