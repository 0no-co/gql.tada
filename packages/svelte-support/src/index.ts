import ts from 'typescript';
import { decode } from '@jridgewell/sourcemap-codec';
import { svelte2tsx } from 'svelte2tsx';
import { TextDocument } from 'vscode-languageserver-textdocument';

import type { CodeMapping, VirtualCode } from './types';

// See: https://github.com/johnsoncodehk/language-tools/blob/volar2/packages/language-server/src/languagePlugin.ts
export const transform = (sourceFile: ts.SourceFile): VirtualCode | undefined => {
  const text = sourceFile.getFullText();

  let tsx: ReturnType<typeof svelte2tsx>;

  try {
    tsx = svelte2tsx(text, {
      filename: sourceFile.fileName,
      isTsFile: true,
      emitOnTemplateError: true,
      mode: 'ts',
    });
  } catch (error) {
    return;
  }

  const v3Mappings = decode(tsx.map.mappings);
  const document = TextDocument.create('', 'svelte', 0, text);
  const generateDocument = TextDocument.create('', 'typescript', 0, tsx.code);
  const mappings: CodeMapping[] = [];

  let current:
    | {
        genOffset: number;
        sourceOffset: number;
      }
    | undefined;

  for (let genLine = 0; genLine < v3Mappings.length; genLine++) {
    for (const segment of v3Mappings[genLine]) {
      const genCharacter = segment[0];
      const genOffset = generateDocument.offsetAt({ line: genLine, character: genCharacter });
      if (current) {
        let length = genOffset - current.genOffset;
        const sourceText = text.substring(current.sourceOffset, current.sourceOffset + length);
        const genText = tsx.code.substring(current.genOffset, current.genOffset + length);
        if (sourceText !== genText) {
          length = 0;
          for (let i = 0; i < genOffset - current.genOffset; i++) {
            if (sourceText[i] === genText[i]) {
              length = i + 1;
            } else {
              break;
            }
          }
        }
        if (length > 0) {
          const lastMapping = mappings.length ? mappings[mappings.length - 1] : undefined;
          if (
            lastMapping &&
            lastMapping.generatedOffsets[0] + lastMapping.lengths[0] === current.genOffset &&
            lastMapping.sourceOffsets[0] + lastMapping.lengths[0] === current.sourceOffset
          ) {
            lastMapping.lengths[0] += length;
          } else {
            mappings.push({
              sourceOffsets: [current.sourceOffset],
              generatedOffsets: [current.genOffset],
              lengths: [length],
              data: {
                verification: true,
                completion: true,
                semantic: true,
                navigation: true,
                structure: false,
                format: false,
              },
            });
          }
        }
        current = undefined;
      }
      if (segment[2] !== undefined && segment[3] !== undefined) {
        const sourceOffset = document.offsetAt({ line: segment[2], character: segment[3] });
        current = {
          genOffset,
          sourceOffset,
        };
      }
    }
  }

  return {
    id: 'ts',
    languageId: 'typescript',
    snapshot: ts.ScriptSnapshot.fromString(tsx.code),
    mappings: mappings,
    embeddedCodes: [],
  } satisfies VirtualCode;
};
