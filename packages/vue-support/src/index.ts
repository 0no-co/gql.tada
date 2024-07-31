import ts from 'typescript';
import * as vueCompilerDOM from '@vue/compiler-dom';
import * as vue from '@vue/language-core';
import { parse } from '@vue/language-core';

import type { VirtualCode } from './types';

const useVueFilePlugin = (): vue.VueLanguagePluginReturn => {
  return {
    version: 2,

    parseSFC(_fileName, content) {
      return parse(content);
    },

    updateSFC(sfc, change) {
      const blocks = [
        sfc.descriptor.template,
        sfc.descriptor.script,
        sfc.descriptor.scriptSetup,
        ...sfc.descriptor.styles,
        ...sfc.descriptor.customBlocks,
      ].filter((block): block is NonNullable<typeof block> => !!block);

      const hitBlock = blocks.find(
        (block) => change.start >= block.loc.start.offset && change.end <= block.loc.end.offset
      );
      if (!hitBlock) {
        return;
      }

      const oldContent = hitBlock.content;
      const newContent = (hitBlock.content =
        hitBlock.content.substring(0, change.start - hitBlock.loc.start.offset) +
        change.newText +
        hitBlock.content.substring(change.end - hitBlock.loc.start.offset));

      // #3449
      const endTagRegex = new RegExp(`</\\s*${hitBlock.type}\\s*>`);
      const insertedEndTag = !!oldContent.match(endTagRegex) !== !!newContent.match(endTagRegex);
      if (insertedEndTag) {
        return;
      }

      const lengthDiff = change.newText.length - (change.end - change.start);

      for (const block of blocks) {
        if (block.loc.start.offset > change.end) {
          block.loc.start.offset += lengthDiff;
        }
        if (block.loc.end.offset >= change.end) {
          block.loc.end.offset += lengthDiff;
        }
      }

      return sfc;
    },
  };
};

function* forEachEmbeddedCode(virtualCode: VirtualCode) {
  yield virtualCode;
  if (virtualCode.embeddedCodes) {
    for (const embeddedCode of virtualCode.embeddedCodes) {
      yield* forEachEmbeddedCode(embeddedCode);
    }
  }
}

let VueVirtualCode: typeof vue.VueVirtualCode | undefined;
if ('VueVirtualCode' in vue) {
  VueVirtualCode = vue.VueVirtualCode;
} else if ('VueGeneratedCode' in vue) {
  VueVirtualCode = (vue as any).VueGeneratedCode;
}

let createPlugins: typeof vue.createPlugins | undefined;
if ('createPlugins' in vue) {
  createPlugins = vue.createPlugins;
} else if ('getBasePlugins' in vue) {
  createPlugins = (vue as any).getBasePlugins;
} else if ('getDefaultVueLanguagePlugins' in vue) {
  createPlugins = (vue as any).getDefaultVueLanguagePlugins;
}

const vueCompilerOptions = vue.resolveVueCompilerOptions({});

let plugins: ReturnType<typeof vue.createPlugins> | undefined;

export const check = () => {
  const undefinedValues = [
    !VueVirtualCode && 'VueVirtualCode',
    !createPlugins && 'createPlugins',
  ].filter(Boolean);
  if (undefinedValues.length) {
    throw new Error(
      'This version of `@vue/language-core` seems to be unsupported. ' +
        `(undefined: ${undefinedValues.join(', ')})\n` +
        'Please report this issue along with your installed version of `@vue/language-core.'
    );
  }
};

export const transform = (sourceFile: ts.SourceFile): VirtualCode | undefined => {
  if (!VueVirtualCode || !createPlugins) {
    return undefined;
  } else if (!plugins) {
    const pluginContext = {
      modules: {
        typescript: ts,
        '@vue/compiler-dom': vueCompilerDOM,
      },
      compilerOptions: {},
      globalTypesHolder: undefined,
      vueCompilerOptions,
    };
    plugins = createPlugins(pluginContext);
    plugins.push(useVueFilePlugin());
  }

  const snapshot = ts.ScriptSnapshot.fromString(sourceFile.getFullText());
  const root = new VueVirtualCode(
    sourceFile.fileName,
    'vue',
    snapshot,
    vueCompilerOptions,
    plugins,
    ...([ts, false] as any as [typeof ts])
  );
  for (const code of forEachEmbeddedCode(root)) if (code.id.startsWith('script_')) return code;
};
