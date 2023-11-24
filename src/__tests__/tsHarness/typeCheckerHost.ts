import {
  CompilerHost,
  CompilerOptions,
  SourceFile,
  TypeCheckerHost,
  FileIncludeKind,
  RedirectTargetsMap,
  ModeAwareCache,
  ResolvedModuleWithFailedLookupLocations,
  StringLiteralLike,
  Path,
  getNormalizedAbsolutePath,
  createModeAwareCache,
  arrayToMultiMap,
  createTypeChecker,
} from '@0no-co/typescript.js';

import { compilerOptions } from './virtualHost';

import {
  findSourceFile,
  getModuleNames,
  getModeForUsageLocation,
  collectExternalModuleReferences,
} from './resolutionUtils';

export interface TypeHost extends TypeCheckerHost {
  getRootSourceFiles(): readonly SourceFile[];
}

export function createTypeHost(rootFileNames: readonly string[], host: CompilerHost): TypeHost {
  const fileIncludeReasons = arrayToMultiMap<any, any>([], () => FileIncludeKind.Import);
  const resolvedTypeReferenceDirectives = createModeAwareCache<any>();
  const resolvedModules = new Map<Path, ModeAwareCache<ResolvedModuleWithFailedLookupLocations>>();
  const rootFiles: SourceFile[] = [];
  const importedFiles: SourceFile[] = [];

  function getSourceFile(filename: string) {
    const file = findSourceFile(filename, host);
    for (const importedFile of processImportedModules(file, host, compilerOptions))
      importedFiles.push(importedFile);
    return file;
  }

  function* processImportedModules(
    file: SourceFile | undefined,
    host: CompilerHost,
    options: CompilerOptions
  ): IterableIterator<SourceFile> {
    if (!file) return;
    collectExternalModuleReferences(file);
    if (
      !resolvedModules.has(file.path) &&
      (file.imports.length || file.moduleAugmentations.length)
    ) {
      const moduleNames = getModuleNames(file);
      const resolutions = resolveModuleNames(moduleNames, file);
      if (resolutions.length === moduleNames.length) {
        const resolutionsInFile = createModeAwareCache<ResolvedModuleWithFailedLookupLocations>();
        resolvedModules.set(file.path, resolutionsInFile);
        for (let index = 0; index < moduleNames.length; index++) {
          const moduleName = moduleNames[index].text;
          const resolvedModule = resolutions[index];
          const mode = getModeForUsageLocation(file, moduleNames[index]);
          resolutionsInFile.set(moduleName, mode, {
            resolvedModule,
          } as ResolvedModuleWithFailedLookupLocations);
          if (resolvedModule) {
            const file = findSourceFile(resolvedModule.resolvedFileName, host);
            if (file) {
              yield* processImportedModules(file, host, options);
              yield file;
            }
          }
        }
      }
    }

    function resolveModuleNames(
      moduleNames: readonly StringLiteralLike[],
      containingFile: SourceFile
    ) {
      if (!moduleNames.length) return [];
      const currentDirectory = host.getCurrentDirectory();
      const containingFileName = getNormalizedAbsolutePath(
        containingFile.originalFileName,
        currentDirectory
      );
      return host.resolveModuleNames!(
        moduleNames.map(literal => literal.text),
        containingFileName,
        undefined,
        undefined,
        options
      );
    }
  }

  for (const rootFileName of rootFileNames) {
    const rootFile = getSourceFile(rootFileName);
    if (rootFile) rootFiles.push(rootFile);
  }

  if (!compilerOptions.noLib) {
    const libFile = getSourceFile(host.getDefaultLibFileName(compilerOptions));
    if (libFile) rootFiles.push(libFile);
  }

  const files = [...importedFiles, ...rootFiles];

  const typeHost: TypeHost = {
    useCaseSensitiveFileNames: host.useCaseSensitiveFileNames,
    getCurrentDirectory: host.getCurrentDirectory,
    directoryExists: host.directoryExists,
    fileExists: host.fileExists,
    readFile: host.readFile,
    realpath: host.realpath,

    getSourceFile,

    typesPackageExists(_packageName) {
      return false;
    },
    packageBundlesTypes(_packageName) {
      return false;
    },
    getResolvedModule(file, moduleName, mode) {
      return resolvedModules?.get(file.path)?.get(moduleName, mode);
    },
    getFileIncludeReasons() {
      return fileIncludeReasons;
    },
    getCompilerOptions() {
      return compilerOptions;
    },
    getSourceFiles() {
      return files;
    },
    getRootSourceFiles() {
      return rootFiles;
    },
    getResolvedTypeReferenceDirectives() {
      return resolvedTypeReferenceDirectives;
    },
    getProjectReferenceRedirect(_filename: string) {
      return undefined;
    },
    isSourceOfProjectReferenceRedirect(_filename: string) {
      return false;
    },
    redirectTargetsMap: new Map() as RedirectTargetsMap,
  };

  const checker = createTypeChecker(typeHost);
  const diagnostics = checker.getGlobalDiagnostics();
  if (diagnostics.length) {
    throw new Error(diagnostics.map(x => x.messageText).join('\n'));
  }

  return typeHost;
}
