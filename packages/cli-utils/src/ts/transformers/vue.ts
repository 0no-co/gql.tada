import ts from 'typescript';
import type { VirtualCode } from '@vue/language-core';
import * as vueCompilerDOM from '@vue/compiler-dom';
import * as vue from '@vue/language-core';

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

let getBasePlugins: typeof vue.getBasePlugins | undefined;
if ('getBasePlugins' in vue) {
  getBasePlugins = vue.getBasePlugins;
} else if ('getDefaultVueLanguagePlugins' in vue) {
  getBasePlugins = (vue as any).getDefaultVueLanguagePlugins;
}

const vueCompilerOptions = vue.resolveVueCompilerOptions({});

let plugins: ReturnType<typeof vue.getBasePlugins> | undefined;

export const transform = (sourceFile: ts.SourceFile): VirtualCode | undefined => {
  if (!VueVirtualCode || !getBasePlugins) {
    return undefined;
  } else if (!plugins) {
    plugins = getBasePlugins({
      modules: {
        typescript: ts,
        '@vue/compiler-dom': vueCompilerDOM,
      },
      compilerOptions: {},
      globalTypesHolder: undefined,
      vueCompilerOptions,
    });
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
