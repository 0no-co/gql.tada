import type { Kind, TypeNode } from '@0no-co/graphql.web';
import type { schema } from '../__tests__/introspection.test-d';
import type { Introspection } from '../introspection';

// TODO: input objects
type UnwrapType<Type extends TypeNode, I extends Introspection<any>> = Type extends {
  kind: Kind.LIST_TYPE;
  type: any;
}
  ? Array<UnwrapType<Type['type'], I>> | null
  : Type extends { kind: Kind.NON_NULL_TYPE; type: any }
  ? NonNullable<UnwrapType<Type['type'], I>>
  : Type extends { kind: 'NamedType'; name: any }
  ? Type['name'] extends { kind: Kind.NAME; value: string }
    ? Type['name']['value'] extends keyof I['types']
      ? I['types'][Type['name']['value']] extends { kind: 'SCALAR'; type: any }
        ? I['types'][Type['name']['value']]['type'] extends string
          ? string | null
          : I['types'][Type['name']['value']]['type'] extends boolean
          ? boolean | null
          : I['types'][Type['name']['value']]['type'] extends number
          ? number | null
          : I['types'][Type['name']['value']]['type'] extends string | number
          ? string | number | null
          : I['types'][Type['name']['value']]['type'] extends bigint
          ? bigint | null
          : never
        : never
      : never
    : never
  : never;

type VariablesContinue<Variables extends readonly any[], I extends Introspection<typeof schema>> = {
  [Name in Variables[0]['variable']['name']['value']]: UnwrapType<Variables[0]['type'], I>;
} & (Variables extends readonly []
  ? {}
  : Variables extends readonly [any, ...infer Rest]
  ? Rest extends readonly []
    ? {}
    : VariablesContinue<Rest, I>
  : {});

type DefinitionContinue<T extends any[], I extends Introspection<typeof schema>> = (T[0] extends {
  kind: Kind.OPERATION_DEFINITION;
  variableDefinitions: any[];
}
  ? T[0]['variableDefinitions'] extends Array<{ kind: Kind.VARIABLE_DEFINITION }>
    ? VariablesContinue<T[0]['variableDefinitions'], I>
    : { novar: true }
  : { noOperation: true }) &
  (T extends readonly []
    ? {}
    : T extends readonly [any, ...infer Rest]
    ? Rest extends readonly []
      ? {}
      : DefinitionContinue<Rest, I>
    : {});

export type Variables<
  D extends { kind: Kind.DOCUMENT; definitions: any[] },
  I extends Introspection<typeof schema>
> = DefinitionContinue<D['definitions'], I>;
