import * as path from 'node:path';
import ts from 'typescript';

export function shouldScanTurboFile(fileName: string, turboOutputPaths: Set<string>): boolean {
  if (turboOutputPaths.has(path.resolve(fileName))) return false;
  if (fileName.endsWith('.d.ts') || fileName.endsWith('.d.mts') || fileName.endsWith('.d.cts')) {
    return false;
  }
  return !/(^|[/\\])node_modules([/\\]|$)/.test(fileName);
}

const GRAPHQL_DOCUMENT_START = /(?:^|[^\w])(query|mutation|subscription|fragment)\b/;

export function hasGraphQLDocumentCandidate(sourceFile: ts.SourceFile): boolean {
  if (!sourceFile.text.includes('{')) return false;

  let hasCandidate = false;

  const visit = (node: ts.Node): void => {
    if (hasCandidate) return;

    if (ts.isCallExpression(node)) {
      const argument = node.arguments[0];
      if (argument && ts.isStringLiteralLike(argument)) {
        const text = argument.text;
        if (text.includes('{') && isGraphQLDocumentCandidateText(text)) {
          hasCandidate = true;
          return;
        }
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return hasCandidate;
}

function isGraphQLDocumentCandidateText(text: string): boolean {
  if (GRAPHQL_DOCUMENT_START.test(text)) return true;

  for (const line of text.split('\n')) {
    const trimmed = line.trimStart();
    if (!trimmed || trimmed.startsWith('#')) continue;
    return trimmed.startsWith('{');
  }

  return false;
}
