import type { TypeHost } from './typeCheckerHost';
import { createTypeChecker } from '@0no-co/typescript.js';

export type { FileData, Files, VirtualHost } from './virtualHost';
export type { TypeHost } from './typeCheckerHost';

export { createTypeChecker } from '@0no-co/typescript.js';
export { createTypeHost } from './typeCheckerHost';
export { createVirtualHost } from './virtualHost';
export { readFileFromRoot, readVirtualModule } from './virtualModules';

export function runDiagnostics(host: TypeHost) {
  const checker = createTypeChecker(host);
  const diagnostics = checker.getDiagnostics().filter(x => !x.file?.isDeclarationFile);
  if (diagnostics.length) {
    throw new Error(diagnostics.map(x => x.messageText).join('\n'));
  }
}
