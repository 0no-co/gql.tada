import * as path from 'node:path';
import * as t from '../../../term';

import type { ScanCorpus, RuleResults, ModuleInfo } from '../types';
import { fieldUsageMap } from './util';

const CWD = process.cwd();

const relative = (filePath: string): string => {
  const rel = path.relative(CWD, filePath);
  return !rel.startsWith('..') ? rel : filePath;
};

const heading = (text: string): string =>
  t.text([
    '\n',
    t.cmd(t.CSI.Style, t.Style.Magenta),
    `${t.SmallTriangle.Right} `,
    t.cmd(t.CSI.Style, t.Style.Foreground),
    text,
    '\n',
  ]);

const item = (text: string, locator?: string): string =>
  t.text([
    t.cmd(t.CSI.Style, t.Style.BrightBlack),
    `  ${t.HeavyBox.BottomLeft} `,
    t.cmd(t.CSI.Style, t.Style.Foreground),
    text,
    ...(locator ? [t.cmd(t.CSI.Style, t.Style.BrightBlack), `  ${locator}`] : []),
    '\n',
  ]);

/** Reverse index: where a schema coordinate (`Type.field`) is used. */
export function renderFieldQuery(
  corpus: ScanCorpus,
  rules: RuleResults,
  coordinate: string
): string {
  const usage = fieldUsageMap(rules).get(coordinate);
  if (!usage) return heading(`Field ${coordinate}`) + item('Not found in the schema.');

  let out = heading(`Field ${coordinate}`);
  out += item(
    `${usage.fieldType}${usage.deprecated ? ' · deprecated' : ''} · selected ${usage.count} time(s)`
  );
  if (!usage.count) return out + item('Never selected by any document.');

  const operationById = new Map(corpus.operations.map((op) => [op.id, op] as const));
  const fragmentById = new Map(
    corpus.fragments.map((fragment) => [fragment.id, fragment] as const)
  );
  for (const site of usage.directUsages) {
    const op = operationById.get(site.defId);
    const fragment = fragmentById.get(site.defId);
    if (op) {
      out += item(op.name || '(anonymous)', `${relative(op.loc.file)}:${op.loc.line}`);
    } else if (fragment) {
      out += item(
        `fragment ${fragment.name}`,
        `${relative(fragment.loc.file)}:${fragment.loc.line}`
      );
    }
  }
  return out;
}

function findModule(corpus: ScanCorpus, query: string): ModuleInfo | undefined {
  const resolved = path.resolve(CWD, query);
  return corpus.modules.find(
    (module) =>
      module.path === resolved || module.relativePath === query || module.path.endsWith(query)
  );
}

/** Forward map: which schema surface a module depends on. */
export function renderModuleQuery(corpus: ScanCorpus, rules: RuleResults, query: string): string {
  const module = findModule(corpus, query);
  if (!module) return heading(`Module ${query}`) + item('No documents found in this module.');

  let out = heading(`Module ${module.relativePath}`);
  const operationById = new Map(corpus.operations.map((op) => [op.id, op] as const));
  const fragmentById = new Map(
    corpus.fragments.map((fragment) => [fragment.id, fragment] as const)
  );

  for (const id of module.operations) {
    const op = operationById.get(id);
    if (op) out += item(`${op.kind} ${op.name || '(anonymous)'}`);
  }
  for (const id of module.fragments) {
    const fragment = fragmentById.get(id);
    if (fragment) out += item(`fragment ${fragment.name} on ${fragment.typeCondition}`);
  }

  // The module's schema surface: coordinates selected by any of its definitions.
  const coordinates = new Set<string>();
  for (const [coordinate, usage] of fieldUsageMap(rules)) {
    if (usage.directUsages.some((site) => site.module === module.path)) coordinates.add(coordinate);
  }

  out += heading(`Schema surface (${coordinates.size} fields)`);
  for (const coordinate of [...coordinates].sort()) out += item(coordinate);
  return out;
}
