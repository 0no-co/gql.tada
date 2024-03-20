import type { CompilerOptions } from 'typescript';

import { ScriptTarget, JsxEmit, ModuleResolutionKind } from 'typescript';

export const compilerOptions: CompilerOptions = {
  rootDir: '/',
  moduleResolution: ModuleResolutionKind.Bundler,
  skipLibCheck: true,
  skipDefaultLibCheck: true,
  allowImportingTsExtensions: true,
  allowSyntheticDefaultImports: true,
  resolvePackageJsonExports: true,
  resolvePackageJsonImports: true,
  resolveJsonModule: true,
  esModuleInterop: true,
  jsx: JsxEmit.Preserve,
  target: ScriptTarget.Latest,
  checkJs: false,
  allowJs: true,
  strict: true,
  noEmit: true,
  noLib: false,
  disableReferencedProjectLoad: true,
  disableSourceOfProjectReferenceRedirect: true,
  disableSizeLimit: true,
  disableSolutionSearching: true,
};
