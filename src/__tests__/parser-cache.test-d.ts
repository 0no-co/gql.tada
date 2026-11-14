import { describe, expectTypeOf, it } from 'vitest';
import type { Kind, OperationTypeNode } from '@0no-co/graphql.web';
import { initGraphQLTada } from '../api';
import type { ResultOf, VariablesOf } from '../api';
import type { parseDocument } from '../parser';
import type { simpleIntrospection } from './fixtures/simpleIntrospection';

type CachedSyntax = {
  kind: Kind.DOCUMENT;
  definitions: [
    {
      kind: Kind.OPERATION_DEFINITION;
      operation: OperationTypeNode.QUERY;
      name: { kind: Kind.NAME; value: 'Cached' };
      variableDefinitions: [];
      directives: [];
      selectionSet: {
        kind: Kind.SELECTION_SET;
        selections: [
          {
            kind: Kind.FIELD;
            name: { kind: Kind.NAME; value: 'todos' };
            alias: undefined;
            arguments: [];
            directives: [];
            selectionSet: {
              kind: Kind.SELECTION_SET;
              selections: [
                {
                  kind: Kind.FIELD;
                  name: { kind: Kind.NAME; value: 'id' };
                  alias: undefined;
                  arguments: [];
                  directives: [];
                  selectionSet: undefined;
                },
              ];
            };
          },
        ];
      };
    },
  ];
};

declare module '../api' {
  interface setupSchema {
    readonly __parsedCache: {
      'query Cached { todos { id } }': CachedSyntax;
      'query WithVariables($limit: Int) { todos(limit: $limit) { id } }': parseDocument<'query WithVariables($limit: Int) { todos(limit: $limit) { id } }'>;
      'query CacheHit { todos { id } }': parseDocument<'query CacheHit { todos { text } }'>;
      'query InvalidEntry { todos { id } }': 'invalid';
      'query NeverEntry { todos { id } }': never;
      'query FragmentQuery { todos { ...CachedFields } }': parseDocument<'query FragmentQuery { todos { ...CachedFields } }'>;
    };
  }
}

const graphql = initGraphQLTada<{ introspection: simpleIntrospection }>();

describe('parsed document cache', () => {
  it('uses a cached syntax tree while inferring result types', () => {
    expectTypeOf<CachedSyntax>().toEqualTypeOf<parseDocument<'query Cached { todos { id } }'>>();
    const doc = graphql('query Cached { todos { id } }');
    expectTypeOf<ResultOf<typeof doc>>().toEqualTypeOf<{
      todos: ({ id: string } | null)[] | null;
    }>();
    const hit = graphql('query CacheHit { todos { id } }');
    expectTypeOf<ResultOf<typeof hit>>().toEqualTypeOf<{
      todos: ({ text: string } | null)[] | null;
    }>();
  });

  it('falls back to parsing absent or invalid cache entries', () => {
    const missing = graphql('query Missing { todos { id } }');
    const invalid = graphql('query InvalidEntry { todos { id } }');
    const never = graphql('query NeverEntry { todos { id } }');
    expectTypeOf<ResultOf<typeof missing>>().toEqualTypeOf<ResultOf<typeof invalid>>();
    expectTypeOf<ResultOf<typeof missing>>().toEqualTypeOf<ResultOf<typeof never>>();
    expectTypeOf<VariablesOf<typeof missing>>().toEqualTypeOf<{}>();
  });

  it('uses the current scalar configuration and infers variables', () => {
    const customGraphql = initGraphQLTada<{
      introspection: simpleIntrospection;
      scalars: { ID: [string] };
    }>();
    const source = 'query WithVariables($limit: Int) { todos(limit: $limit) { id } }';
    const regular = graphql(source);
    const custom = customGraphql(source);
    expectTypeOf<ResultOf<typeof regular>>().toEqualTypeOf<{
      todos: ({ id: string } | null)[] | null;
    }>();
    expectTypeOf<ResultOf<typeof custom>>().toEqualTypeOf<{
      todos: ({ id: [string] } | null)[] | null;
    }>();
    expectTypeOf<VariablesOf<typeof custom>>().toEqualTypeOf<{ limit?: number | null }>();
  });

  it('infers imported fragment fields from the current fragment', () => {
    const fragment = graphql('fragment CachedFields on Todo @_unmask { text }');
    const query = graphql('query FragmentQuery { todos { ...CachedFields } }', [fragment]);
    expectTypeOf<ResultOf<typeof query>>().toEqualTypeOf<{
      todos: ({ text: string } | null)[] | null;
    }>();
  });
});
