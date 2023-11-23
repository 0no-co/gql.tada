export type { FileData, Files, VirtualHost } from './virtualHost';
export type { TypeHost } from './typeCheckerHost';

export { createTypeChecker } from '@0no-co/typescript.js';
export { createTypeHost } from './typeCheckerHost';
export { createVirtualHost } from './virtualHost';
export { readFileFromRoot, readVirtualModule } from './virtualModules';
