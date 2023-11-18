import type { Kind, TypeNode } from '@0no-co/graphql.web';
import type { Introspection as IntrospectionType } from '../introspection';

type InputValues<
  InputFields extends any[],
  Introspection extends IntrospectionType<any>
> = (InputFields[0] extends { name: string; type: string }
  ? { [Name in InputFields[0]['name']]: UnwrapType<InputFields[0]['type'], Introspection> }
  : never) &
  InputFields[0] &
  (InputFields extends readonly [any, ...infer Rest]
    ? Rest extends readonly []
      ? {}
      : InputValues<Rest, Introspection>
    : never);

type ScalarType<
  Type extends { kind: 'NamedType'; name: any },
  Introspection extends IntrospectionType<any>
> = Type['name'] extends { kind: Kind.NAME; value: infer Value }
  ? Value extends keyof Introspection['types']
    ? Introspection['types'][Value] extends {
        kind: 'SCALAR' | 'ENUM';
        type: infer IntrospectionValueType;
      }
      ? IntrospectionValueType | null
      : Introspection['types'][Value] extends {
          kind: 'INPUT_OBJECT';
        }
      ? InputValues<Introspection['types'][Type['name']['value']]['inputFields'], Introspection>
      : never
    : never
  : never;

type UnwrapType<
  Type extends TypeNode,
  Introspection extends IntrospectionType<any>
> = Type extends {
  kind: Kind.LIST_TYPE;
  type: any;
}
  ? Array<UnwrapType<Type['type'], Introspection>> | null
  : Type extends { kind: Kind.NON_NULL_TYPE; type: any }
  ? NonNullable<UnwrapType<Type['type'], Introspection>>
  : Type extends { kind: 'NamedType'; name: any }
  ? ScalarType<Type, Introspection>
  : never;

type VariablesContinue<
  Variables extends readonly any[],
  Introspection extends IntrospectionType<any>
> = {
  [Name in Variables[0]['variable']['name']['value']]: UnwrapType<
    Variables[0]['type'],
    Introspection
  >;
} & (Variables extends readonly [any, ...infer Rest]
  ? Rest extends readonly []
    ? {}
    : VariablesContinue<Rest, Introspection>
  : never);

type DefinitionContinue<
  Definitions extends any[],
  Introspection extends IntrospectionType<any>
> = (Definitions[0] extends {
  kind: Kind.OPERATION_DEFINITION;
  variableDefinitions: infer VarDefs;
}
  ? VarDefs extends Array<{ kind: Kind.VARIABLE_DEFINITION }>
    ? VariablesContinue<VarDefs, Introspection>
    : never
  : never) &
  (Definitions extends readonly [any, ...infer Rest]
    ? Rest extends readonly []
      ? {}
      : DefinitionContinue<Rest, Introspection>
    : never);

export type Variables<
  D extends { kind: Kind.DOCUMENT; definitions: any[] },
  I extends IntrospectionType<any>
> = DefinitionContinue<D['definitions'], I>;
