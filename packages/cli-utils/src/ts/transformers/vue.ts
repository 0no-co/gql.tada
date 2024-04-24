import ts from 'typescript';
import type { VirtualCode } from '@vue/language-core';
import { forEachEmbeddedCode, getDefaultVueLanguagePlugins } from '@vue/language-core';
import * as vueCompilerDOM from '@vue/compiler-dom';
import * as vue from '@vue/language-core';

let VueVirtualCode: typeof vue.VueVirtualCode | undefined;
if ('VueVirtualCode' in vue) {
  VueVirtualCode = vue.VueVirtualCode;
} else if ('VueGeneratedCode' in vue) {
  VueVirtualCode = (vue as any).VueGeneratedCode;
}

const vueCompilerOptions = vue.resolveVueCompilerOptions({});

let plugins: ReturnType<typeof getDefaultVueLanguagePlugins> | undefined;

export const transform = (sourceFile: ts.SourceFile): VirtualCode | undefined => {
  if (!VueVirtualCode) {
    return undefined;
  } else if (!plugins) {
    plugins = getDefaultVueLanguagePlugins({
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
