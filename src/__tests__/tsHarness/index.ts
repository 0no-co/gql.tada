import type { TypeHost } from './typeCheckerHost';
import { DiagnosticMessageChain, createTypeChecker } from '@0no-co/typescript.js';

export type { FileData, Files, VirtualHost } from './virtualHost';
export type { TypeHost } from './typeCheckerHost';

export { createTypeChecker } from '@0no-co/typescript.js';
export { createTypeHost } from './typeCheckerHost';

export {
  createVirtualHost,
  readFileFromRoot,
  readVirtualModule,
  readSourceFolders,
} from './virtualHost';

export function runDiagnostics(host: TypeHost) {
  const checker = createTypeChecker(host);
  const diagnostics = checker.getDiagnostics().filter(x => !x.file?.isDeclarationFile);
  if (diagnostics.length) {
    throw new Error(
      diagnostics
        .map(x => (x.messageText as DiagnosticMessageChain)?.messageText || x.messageText)
        .join('\n')
    );
  }
}
