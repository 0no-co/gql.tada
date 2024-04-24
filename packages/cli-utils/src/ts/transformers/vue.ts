import ts from 'typescript';
import type { VirtualCode } from '@vue/language-core';
import { forEachEmbeddedCode, getDefaultVueLanguagePlugins } from '@vue/language-core';
import * as vueCompilerDOM from '@vue/compiler-dom';
import * as vue from '@vue/language-core';

const VueVirtualCode =
  vue.VueGeneratedCode || ((vue as any).VirtualCode as typeof vue.VueGeneratedCode);

const vueCompilerOptions = vue.resolveVueCompilerOptions({});

let plugins: ReturnType<typeof getDefaultVueLanguagePlugins> | undefined;

export const transform = (sourceFile: ts.SourceFile): VirtualCode | undefined => {
  if (!plugins) {
    plugins = getDefaultVueLanguagePlugins({
      modules: {
        typescript: ts,
        '@vue/compiler-dom': vueCompilerDOM,
      },
      compilerOptions: {},
      codegenStack: false,
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
    ts,
    false
  );
  for (const code of forEachEmbeddedCode(root)) if (code.id.startsWith('script_')) return code;
};
