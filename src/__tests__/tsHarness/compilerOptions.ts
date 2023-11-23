import {
  CompilerOptions,
  ModuleResolutionKind,
  ScriptTarget,
  JsxEmit,
} from '@0no-co/typescript.js';

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
  jsx: 1 satisfies JsxEmit.Preserve,
  target: 99 satisfies ScriptTarget.Latest,
  checkJs: false,
  allowJs: true,
  strict: false,
  noEmit: true,
  noLib: false,
  disableSizeLimit: true,
  disableSolutionSearching: true,
};
