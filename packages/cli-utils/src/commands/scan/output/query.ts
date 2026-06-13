import * as path from 'node:path';
import * as t from '../../../term';

import type { ScanMetadata, ModuleInfo } from '../types';

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
export function renderFieldQuery(metadata: ScanMetadata, coordinate: string): string {
  const entry = metadata.fieldIndex[coordinate];
  if (!entry) {
    return heading(`Field ${coordinate}`) + item('Not found in the schema.');
  }

  let out = heading(`Field ${coordinate}`);
  out += item(
    `${entry.fieldType}${entry.deprecated ? ' · deprecated' : ''} · selected ${entry.count} time(s)`
  );
  if (!entry.count) return out + item('Never selected by any document.');

  const operationName = new Map(metadata.operations.map((op) => [op.id, op] as const));
  const fragmentName = new Map(
    metadata.fragments.map((fragment) => [fragment.id, fragment] as const)
  );
  for (const usage of entry.directUsages) {
    const op = operationName.get(usage.defId);
    const fragment = fragmentName.get(usage.defId);
    if (op) {
      out += item(`${op.name || '(anonymous)'}`, `${relative(op.loc.file)}:${op.loc.line}`);
    } else if (fragment) {
      out += item(
        `fragment ${fragment.name}`,
        `${relative(fragment.loc.file)}:${fragment.loc.line}`
      );
    }
  }
  return out;
}

function findModule(metadata: ScanMetadata, query: string): ModuleInfo | undefined {
  const resolved = path.resolve(CWD, query);
  return metadata.modules.find(
    (module) =>
      module.path === resolved || module.relativePath === query || module.path.endsWith(query)
  );
}

/** Forward map: which schema surface a module depends on. */
export function renderModuleQuery(metadata: ScanMetadata, query: string): string {
  const module = findModule(metadata, query);
  if (!module) return heading(`Module ${query}`) + item('No documents found in this module.');

  let out = heading(`Module ${module.relativePath}`);
  const operationById = new Map(metadata.operations.map((op) => [op.id, op] as const));
  const fragmentById = new Map(
    metadata.fragments.map((fragment) => [fragment.id, fragment] as const)
  );

  const coordinates = new Set<string>();
  for (const id of module.operations) {
    const op = operationById.get(id);
    if (!op) continue;
    out += item(`${op.kind} ${op.name || '(anonymous)'}`, `${op.fields.length} fields`);
    for (const coordinate of op.fields) coordinates.add(coordinate);
  }
  for (const id of module.fragments) {
    const fragment = fragmentById.get(id);
    if (!fragment) continue;
    out += item(
      `fragment ${fragment.name} on ${fragment.typeCondition}`,
      `${fragment.fields.length} fields`
    );
    for (const coordinate of fragment.fields) coordinates.add(coordinate);
  }

  out += heading(`Schema surface (${coordinates.size} fields)`);
  for (const coordinate of [...coordinates].sort()) out += item(coordinate);
  return out;
}
