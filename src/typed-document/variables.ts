import type { Kind, TypeNode } from '@0no-co/graphql.web';
import type { Introspection as IntrospectionType } from '../introspection';
import type { Obj } from '../utils';

type InputValues<
  InputFields extends readonly unknown[],
  Introspection extends IntrospectionType<any>
> = InputFields extends [infer InputField, ...infer Rest]
  ? (InputField extends { name: any; type: any }
      ? // TODO: This is unwrapping with an incorrect reference mapper:
        { [Name in InputField['name']]: UnwrapType<InputField['type'], Introspection> }
      : {}) &
      InputValues<Rest, Introspection>
  : {};

type ScalarType<
  Type extends { kind: 'NamedType'; name: any },
  Introspection extends IntrospectionType<any>
> = Type['name'] extends { kind: Kind.NAME; value: infer Value }
  ? Value extends keyof Introspection['types']
    ? Introspection['types'][Value] extends {
        kind: 'SCALAR' | 'ENUM';
        type: infer IntrospectionValueType;
      }
      ? IntrospectionValueType
      : Introspection['types'][Value] extends {
          kind: 'INPUT_OBJECT';
          inputFields: [...infer InputFields];
        }
      ? Obj<InputValues<InputFields, Introspection>>
      : never
    : never
  : never;

type UnwrapTypeInner<
  Type extends TypeNode,
  Introspection extends IntrospectionType<any>
> = Type extends { kind: 'NonNullType' }
  ? UnwrapTypeInner<Type['type'], Introspection>
  : Type extends { kind: 'ListType' }
  ? Array<UnwrapType<Type['type'], Introspection>>
  : Type extends { kind: 'NamedType' }
  ? ScalarType<Type, Introspection>
  : never;

type UnwrapType<
  Type extends TypeNode,
  Introspection extends IntrospectionType<any>
> = Type extends { kind: 'NonNullType' }
  ? UnwrapTypeInner<Type['type'], Introspection>
  : null | UnwrapTypeInner<Type, Introspection>;

type VariablesContinue<
  Variables extends readonly unknown[],
  Introspection extends IntrospectionType<any>
> = Variables extends [infer Variable, ...infer Rest]
  ? (Variable extends { kind: Kind.VARIABLE_DEFINITION; variable: any; type: any }
      ? Variable extends { defaultValue: undefined }
        ? {
            [Name in Variable['variable']['name']['value']]: UnwrapType<
              Variable['type'],
              Introspection
            >;
          }
        : {
            [Name in Variable['variable']['name']['value']]?: UnwrapType<
              Variable['type'],
              Introspection
            >;
          }
      : {}) &
      VariablesContinue<Rest, Introspection>
  : {};

type DefinitionContinue<
  Definitions extends readonly unknown[],
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
> = Obj<DefinitionContinue<D['definitions'], I>>;
