import type { IScriptSnapshot } from 'typescript';
import type { VirtualCode } from '@vue/language-core';
import { forEachEmbeddedCode } from '@vue/language-core';
import * as vue from '@vue/language-core';

const VueVirtualCode =
  vue.VueGeneratedCode || ((vue as any).VirtualCode as typeof vue.VueGeneratedCode);

const plugins = [];
const codegenStack = false;

export function createVueCode(
  fileId: string,
  snapshot: IScriptSnapshot,
  ts: typeof import('typescript/lib/tsserverlibrary')
): VirtualCode | undefined {
  const vueOptions = vue.resolveVueCompilerOptions({});
  const root = new VueVirtualCode(fileId, 'vue', snapshot, vueOptions, plugins, ts, codegenStack);
  for (const code of forEachEmbeddedCode(root)) if (code.id.startsWith('script_')) return code;
}
