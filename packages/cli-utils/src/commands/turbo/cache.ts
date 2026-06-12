import ts from 'typescript';
import * as fs from 'node:fs';

const HASH_COMMENT = /@gql\.tada\/hash\s+([^\s*]+)/;

export interface CachedTurboDocument {
  documentHash: string;
  documentType: string;
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
