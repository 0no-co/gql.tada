import ts from 'typescript';
import * as fs from 'node:fs';
import { INPUT_ALIAS_PREFIX } from './types';

const HASH_COMMENT = /@gql\.tada\/hash\s+([^\s*]+)/;

export interface CachedTurboDocument {
  documentHash: string;
  documentType: string;
  inputTypes?: Record<string, string> | undefined;
}

export type CachedTurboDocuments = Map<string, CachedTurboDocument>;

export function readCachedTurboDocuments(cachePath: string | undefined): CachedTurboDocuments {
  const documents: CachedTurboDocuments = new Map();
  if (!cachePath || !fs.existsSync(cachePath)) {
    return documents;
  }

  let contents: string;
  try {
    contents = fs.readFileSync(cachePath, 'utf8');
  } catch {
    return documents;
  }

  const sourceFile = ts.createSourceFile(
    cachePath,
    contents,
    ts.ScriptTarget.Latest,
    /*setParentNodes*/ true,
    ts.ScriptKind.TS
  );

  const aliases = new Map<string, ts.TypeNode>();
  for (const statement of sourceFile.statements) {
    if (
      ts.isTypeAliasDeclaration(statement) &&
      statement.name.text.startsWith(INPUT_ALIAS_PREFIX)
    ) {
      aliases.set(statement.name.text, statement.type);
    }
  }
  const collectInputs = (type: ts.TypeNode): Record<string, string> | undefined => {
    const inputs: Record<string, string> = {};
    const visit = (node: ts.Node): void => {
      if (ts.isTypeReferenceNode(node) && ts.isIdentifier(node.typeName)) {
        const name = node.typeName.text;
        const alias = aliases.get(name);
        if (alias && !(name in inputs)) {
          inputs[name] = alias.getText(sourceFile);
          visit(alias);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(type);
    return Object.keys(inputs).length ? inputs : undefined;
  };

  const visit = (node: ts.Node) => {
    if (ts.isInterfaceDeclaration(node) && node.name.text === 'setupCache') {
      for (const member of node.members) {
        if (!ts.isPropertySignature(member) || !member.type) continue;
        if (!ts.isStringLiteral(member.name) && !ts.isNumericLiteral(member.name)) continue;

        const documentHash = getHashComment(contents, member);
        if (!documentHash) continue;

        documents.set(JSON.stringify(member.name.text), {
          documentHash,
          documentType: member.type.getText(sourceFile),
          ...(aliases.size ? { inputTypes: collectInputs(member.type) } : {}),
        });
      }
    }

    ts.forEachChild(node, visit);
  };

  visit(sourceFile);
  return documents;
}

function getHashComment(contents: string, node: ts.Node): string | undefined {
  const comments = ts.getLeadingCommentRanges(contents, node.pos) || [];
  for (let i = comments.length - 1; i >= 0; i--) {
    const comment = contents.slice(comments[i].pos, comments[i].end);
    const match = HASH_COMMENT.exec(comment);
    if (match) return match[1];
  }
  return undefined;
}
