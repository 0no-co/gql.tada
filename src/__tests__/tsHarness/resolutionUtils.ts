import type {
  CompilerHost,
  StringLiteralLike,
  StringLiteral,
  Identifier,
  SourceFile,
  Statement,
  NodeFlags,
  ModifierFlags,
  SyntaxKind,
  ModuleDeclaration,
  ModuleBlock,
  Mutable,
  Node,
  ResolutionMode,
  JSDocParsingMode,
  CreateSourceFileOptions,
} from '@0no-co/typescript.js';
import {
  ModuleKind,
  walkUpParenthesizedExpressions,
  isImportEqualsDeclaration,
  toPath,
  isSourceFileJS,
  isExternalModule,
  isStringLiteral,
  isStringLiteralLike,
  isImportDeclaration,
  isExportDeclaration,
  isExclusivelyTypeOnlyImportOrExport,
  getResolutionModeOverride,
  isImportTypeNode,
  isExternalModuleNameRelative,
  isRequireCall,
  isImportCall,
  forEach,
  forEachChild,
  hasJSDocNodes,
  isLiteralImportTypeNode,
  isAnyImportOrReExport,
  getExternalModuleName,
  setParentRecursive,
  isModuleDeclaration,
  isAmbientModule,
  getTextOfIdentifierOrLiteral,
  hasSyntacticModifier,
  getEmitScriptTarget,
  getSetExternalModuleIndicator,
} from '@0no-co/typescript.js';

import { compilerOptions } from './virtualHost';

export function getModuleNames({ imports, moduleAugmentations }: SourceFile): StringLiteralLike[] {
  const res = [...imports];
  for (const aug of moduleAugmentations)
    if (aug.kind === (11 satisfies SyntaxKind.StringLiteral)) res.push(aug);
  return res;
}

function getCreateSourceFileOptions(): CreateSourceFileOptions {
  const languageVersion = getEmitScriptTarget(compilerOptions);
  const setExternalModuleIndicator = getSetExternalModuleIndicator(compilerOptions);
  const jsDocParsingMode = 0 satisfies JSDocParsingMode.ParseAll;
  return {
    impliedNodeFormat: 99 satisfies ModuleKind.ESNext,
    languageVersion,
    setExternalModuleIndicator,
    jsDocParsingMode,
  };
}

export function findSourceFile(fileName: string, host: CompilerHost): SourceFile | undefined {
  const file = host.getSourceFile(fileName, getCreateSourceFileOptions());
  if (file) {
    const path = toPath(fileName, host.getCurrentDirectory(), host.getCanonicalFileName);
    file.fileName = file.originalFileName = fileName;
    file.path = file.resolvedPath = path;
  }
  return file;
}

export function getModeForUsageLocation(
  file: { impliedNodeFormat?: ResolutionMode },
  usage: StringLiteralLike
) {
  if (isImportDeclaration(usage.parent) || isExportDeclaration(usage.parent)) {
    const isTypeOnly = isExclusivelyTypeOnlyImportOrExport(usage.parent);
    if (isTypeOnly) {
      const override = getResolutionModeOverride(usage.parent.attributes);
      if (override) {
        return override;
      }
    }
  }
  if (usage.parent.parent && isImportTypeNode(usage.parent.parent)) {
    const override = getResolutionModeOverride(usage.parent.parent.attributes);
    if (override) {
      return override;
    }
  }
  if (file.impliedNodeFormat === undefined) return undefined;
  if (file.impliedNodeFormat !== ModuleKind.ESNext) {
    // in cjs files, import call expressions are esm format, otherwise everything is cjs
    return isImportCall(walkUpParenthesizedExpressions(usage.parent))
      ? ModuleKind.ESNext
      : ModuleKind.CommonJS;
  }
  // in esm files, import=require statements are cjs format, otherwise everything is esm
  // imports are only parent'd up to their containing declaration/expression, so access farther parents with care
  const exprParentParent = walkUpParenthesizedExpressions(usage.parent)?.parent;
  return exprParentParent && isImportEqualsDeclaration(exprParentParent)
    ? ModuleKind.CommonJS
    : ModuleKind.ESNext;
}

export function collectExternalModuleReferences(file: SourceFile): void {
  if (file.imports) {
    return;
  }

  const isJavaScriptFile = isSourceFileJS(file);
  const isExternalModuleFile = isExternalModule(file);

  // file.imports may not be undefined if there exists dynamic import
  let imports: StringLiteralLike[] | undefined;
  let moduleAugmentations: (StringLiteral | Identifier)[] | undefined;
  let ambientModules: string[] | undefined;
  for (const node of file.statements) {
    collectModuleReferences(node, /*inAmbientModule*/ false);
  }

  const shouldProcessRequires = isJavaScriptFile; // && shouldResolveJsRequire(compilerOptions);
  if (
    file.flags & (4194304 satisfies NodeFlags.PossiblyContainsDynamicImport) ||
    shouldProcessRequires
  ) {
    collectDynamicImportOrRequireCalls(file);
  }

  file.imports = imports || [];
  file.moduleAugmentations = moduleAugmentations || [];
  file.ambientModuleNames = ambientModules || [];

  return;

  function collectModuleReferences(node: Statement, inAmbientModule: boolean): void {
    if (isAnyImportOrReExport(node)) {
      const moduleNameExpr = getExternalModuleName(node);
      // TypeScript 1.0 spec (April 2014): 12.1.6
      // An ExternalImportDeclaration in an AmbientExternalModuleDeclaration may reference other external modules
      // only through top - level external module names. Relative external module names are not permitted.
      if (
        moduleNameExpr &&
        isStringLiteral(moduleNameExpr) &&
        moduleNameExpr.text &&
        (!inAmbientModule || !isExternalModuleNameRelative(moduleNameExpr.text))
      ) {
        setParentRecursive(node, /*incremental*/ false); // we need parent data on imports before the program is fully bound, so we ensure it's set here
        (imports ??= []).push(moduleNameExpr);
      }
    } else if (isModuleDeclaration(node)) {
      if (
        isAmbientModule(node) &&
        (inAmbientModule ||
          hasSyntacticModifier(node, 128 satisfies ModifierFlags.Ambient) ||
          file.isDeclarationFile)
      ) {
        (node.name as Mutable<Node>).parent = node;
        const nameText = getTextOfIdentifierOrLiteral(node.name);
        // Ambient module declarations can be interpreted as augmentations for some existing external modules.
        // This will happen in two cases:
        // - if current file is external module then module augmentation is a ambient module declaration defined in the top level scope
        // - if current file is not external module then module augmentation is an ambient module declaration with non-relative module name
        //   immediately nested in top level ambient module declaration .
        if (isExternalModuleFile || (inAmbientModule && !isExternalModuleNameRelative(nameText))) {
          (moduleAugmentations || (moduleAugmentations = [])).push(node.name);
        } else if (!inAmbientModule) {
          if (file.isDeclarationFile) {
            // for global .d.ts files record name of ambient module
            (ambientModules || (ambientModules = [])).push(nameText);
          }
          // An AmbientExternalModuleDeclaration declares an external module.
          // This type of declaration is permitted only in the global module.
          // The StringLiteral must specify a top - level external module name.
          // Relative external module names are not permitted

          // NOTE: body of ambient module is always a module block, if it exists
          const body = (node as ModuleDeclaration).body as ModuleBlock;
          if (body) {
            for (const statement of body.statements) {
              collectModuleReferences(statement, /*inAmbientModule*/ true);
            }
          }
        }
      }
    }
  }

  function collectDynamicImportOrRequireCalls(file: SourceFile) {
    const r = /import|require/g;
    while (r.exec(file.text) !== null) {
      const node = getNodeAtPosition(file, r.lastIndex);
      if (shouldProcessRequires && isRequireCall(node, /*requireStringLiteralLikeArgument*/ true)) {
        setParentRecursive(node, /*incremental*/ false); // we need parent data on imports before the program is fully bound, so we ensure it's set here
        (imports ??= []).push(node.arguments[0]);
      }
      // we have to check the argument list has length of at least 1. We will still have to process these even though we have parsing error.
      else if (
        isImportCall(node) &&
        node.arguments.length >= 1 &&
        isStringLiteralLike(node.arguments[0])
      ) {
        setParentRecursive(node, /*incremental*/ false); // we need parent data on imports before the program is fully bound, so we ensure it's set here
        (imports ??= []).push(node.arguments[0]);
      } else if (isLiteralImportTypeNode(node)) {
        setParentRecursive(node, /*incremental*/ false); // we need parent data on imports before the program is fully bound, so we ensure it's set here
        (imports ??= []).push(node.argument.literal);
      }
    }
  }

  /** Returns a token if position is in [start-of-leading-trivia, end), includes JSDoc only in JS files */
  function getNodeAtPosition(sourceFile: SourceFile, position: number): Node {
    let current: Node = sourceFile;
    const getContainingChild = (child: Node) => {
      if (
        child.pos <= position &&
        (position < child.end ||
          (position === child.end && child.kind === (1 satisfies SyntaxKind.EndOfFileToken)))
      ) {
        return child;
      }
    };
    while (true) {
      const child =
        (isJavaScriptFile &&
          hasJSDocNodes(current) &&
          forEach(current.jsDoc, getContainingChild)) ||
        forEachChild(current, getContainingChild);
      if (!child) {
        return current;
      }
      current = child;
    }
  }
}
