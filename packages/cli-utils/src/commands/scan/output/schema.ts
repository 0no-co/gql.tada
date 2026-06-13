import { printSchema, parse, print, visit, Kind } from 'graphql';
import type { GraphQLSchema, FieldDefinitionNode } from 'graphql';

import type { ScanCorpus, RuleResults } from '../types';
import { fieldUsageMap } from './util';

export type AnnotationStyle = 'comment' | 'description';

/** Maximum number of operation names listed in a field annotation. */
const MAX_OPS = 5;

/** Builds the annotation text (without comment/description syntax) for each
 * schema coordinate, from the field-usage rule's index. */
function buildAnnotations(corpus: ScanCorpus, rules: RuleResults): Map<string, string> {
  const operationName = new Map<string, string>();
  for (const op of corpus.operations) operationName.set(op.id, op.name || '(anonymous)');

  const annotations = new Map<string, string>();
  for (const [coordinate, usage] of fieldUsageMap(rules)) {
    const parts: string[] = [`usage: ${usage.count}`];
    if (usage.count === 0) {
      parts.push('UNUSED');
    } else {
      const names = [...new Set(usage.operations.map((id) => operationName.get(id) || id))];
      const shown = names.slice(0, MAX_OPS);
      if (shown.length) {
        const more = names.length > shown.length ? `, +${names.length - shown.length} more` : '';
        parts.push(`ops: ${shown.join(', ')}${more}`);
      }
    }
    if (usage.deprecated) parts.push('deprecated');
    annotations.set(coordinate, parts.join(' · '));
  }
  return annotations;
}

/** Renders the schema's SDL with per-field usage metadata.
 *
 * @param style - `comment` injects `#` comment lines above each field;
 *                `description` folds the metadata into block-string descriptions. */
export function renderAnnotatedSchema(
  schema: GraphQLSchema,
  corpus: ScanCorpus,
  rules: RuleResults,
  style: AnnotationStyle
): string {
  const annotations = buildAnnotations(corpus, rules);
  return style === 'description'
    ? renderWithDescriptions(schema, annotations)
    : renderWithComments(schema, annotations);
}

const TYPE_OPEN = /^(?:type|interface)\s+(\w+)/;
const FIELD_LINE = /^(\s+)(\w+)\s*[(:]/;

/** Injects `#` comment lines above each annotated field in the printed SDL. */
function renderWithComments(schema: GraphQLSchema, annotations: Map<string, string>): string {
  const lines = printSchema(schema).split('\n');
  const out: string[] = [];
  let currentType: string | null = null;
  let inBlockString = false;

  for (const line of lines) {
    // Track block-string descriptions so we never inject inside one.
    const tripleQuotes = (line.match(/"""/g) || []).length;
    if (tripleQuotes % 2 === 1) inBlockString = !inBlockString;

    if (!inBlockString && currentType) {
      const field = FIELD_LINE.exec(line);
      if (field) {
        const annotation = annotations.get(`${currentType}.${field[2]}`);
        if (annotation) out.push(`${field[1]}# ${annotation}`);
      }
    }

    if (!inBlockString) {
      const open = TYPE_OPEN.exec(line);
      if (open && line.includes('{')) {
        currentType = open[1];
      } else if (/^}/.test(line)) {
        currentType = null;
      }
    }

    out.push(line);
  }

  return out.join('\n');
}

/** Folds annotations into block-string descriptions via the SDL AST. */
function renderWithDescriptions(schema: GraphQLSchema, annotations: Map<string, string>): string {
  const ast = parse(printSchema(schema));
  let currentType: string | null = null;

  const annotate = (node: FieldDefinitionNode): FieldDefinitionNode | undefined => {
    if (!currentType) return undefined;
    const annotation = annotations.get(`${currentType}.${node.name.value}`);
    if (!annotation) return undefined;
    const existing = node.description ? node.description.value : '';
    const value = existing ? `${existing}\n\n${annotation}` : annotation;
    return { ...node, description: { kind: Kind.STRING, value, block: true } };
  };

  const annotated = visit(ast, {
    ObjectTypeDefinition: {
      enter: (node) => void (currentType = node.name.value),
      leave: () => void (currentType = null),
    },
    InterfaceTypeDefinition: {
      enter: (node) => void (currentType = node.name.value),
      leave: () => void (currentType = null),
    },
    FieldDefinition: (node) => annotate(node),
  });

  return print(annotated);
}
