import { describe, bench } from 'vitest';
import * as ts from './tsHarness';

describe('TypedDocument', () => {
  const virtualHost = ts.createVirtualHost({
    ...ts.readVirtualModule('@0no-co/graphql.web'),
    ...ts.readSourceFolders(['.']),
    'simpleSchema.ts': ts.readFileFromRoot('src/__tests__/fixtures/simpleSchema.ts'),
    'index.ts': `
      import { Kind, OperationTypeNode } from '@0no-co/graphql.web';
      import { simpleSchema as schema } from './simpleSchema';
      import { parseDocument } from './parser';
      import { getDocumentType } from './selection';
      import { getVariablesType } from './variables';

      type document = {
        kind: Kind.DOCUMENT;
        definitions: [{
          kind: Kind.OPERATION_DEFINITION;
          operation: OperationTypeNode.QUERY;
          name: undefined;
          variableDefinitions: [{
            kind: Kind.VARIABLE_DEFINITION;
            variable: {
              kind: Kind.VARIABLE;
              name: {
                kind: Kind.NAME;
                value: 'test';
              };
            };
            type: {
              kind: Kind.NON_NULL_TYPE;
              type: {
                kind: Kind.NAMED_TYPE;
                name: {
                  kind: Kind.NAME;
                  value: 'String';
                };
              };
            };
            defaultValue: undefined;
            directives: [];
          }];
          selectionSet: {
            kind: Kind.SELECTION_SET;
            selections: [{
              kind: Kind.FIELD;
              alias: undefined;
              name: {
                kind: Kind.NAME;
                value: 'todos';
              };
              directives: [];
              arguments: [];
              selectionSet: {
                kind: Kind.SELECTION_SET;
                selections: [{
                  kind: Kind.FIELD;
                  alias: undefined;
                  name: {
                    kind: Kind.NAME;
                    value: 'id';
                  };
                  selectionSet: undefined;
                  directives: [];
                  arguments: [];
                }];
              };
            }]
          };
          directives: [];
        }];
      };

      type Result = getDocumentType<document, schema>;
      type Input = getVariablesType<document, schema>;
    `,
  });

  const typeHost = ts.createTypeHost({
    rootNames: ['index.ts'],
    host: virtualHost,
  });

  bench('derives typed document', () => {
    ts.runDiagnostics(typeHost);
  });
});
