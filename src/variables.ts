import type { Kind, TypeNode } from '@0no-co/graphql.web';
import type { IntrospectionLikeType } from './introspection';
import type { Obj } from './utils';

type InputValues<
  InputFields extends readonly unknown[],
  Introspection extends IntrospectionLikeType,
> = InputFields extends [infer InputField, ...infer Rest]
  ? (InputField extends { name: any; type: any }
      ? { [Name in InputField['name']]: UnwrapType<InputField['type'], Introspection> }
      : {}) &
      InputValues<Rest, Introspection>
  : {};

type ScalarType<
  TypeName,
  Introspection extends IntrospectionLikeType,
> = TypeName extends keyof Introspection['types']
  ? Introspection['types'][TypeName] extends {
      kind: 'SCALAR' | 'ENUM';
      type: infer IntrospectionValueType;
    }
    ? IntrospectionValueType
    : Introspection['types'][TypeName] extends {
          kind: 'INPUT_OBJECT';
          inputFields: [...infer InputFields];
        }
      ? Obj<InputValues<InputFields, Introspection>>
      : never
  : never;

type UnwrapTypeInner<
  Type extends TypeNode,
  Introspection extends IntrospectionLikeType,
> = Type extends { kind: 'NON_NULL' }
  ? UnwrapTypeInner<Type['ofType'], Introspection>
  : Type extends { kind: 'LIST' }
    ? Array<UnwrapType<Type['ofType'], Introspection>>
    : Type extends { name: infer Name }
      ? Name extends keyof Introspection['types']
        ? ScalarType<Name, Introspection>
        : unknown
      : never;

type UnwrapType<Type extends TypeNode, Introspection extends IntrospectionLikeType> = Type extends {
  kind: 'NON_NULL';
}
  ? UnwrapTypeInner<Type['ofType'], Introspection>
  : null | UnwrapTypeInner<Type, Introspection>;

type UnwrapTypeRefInner<
  Type extends TypeNode,
  Introspection extends IntrospectionLikeType,
> = Type extends { kind: Kind.NON_NULL_TYPE }
  ? UnwrapTypeRefInner<Type['type'], Introspection>
  : Type extends { kind: Kind.LIST_TYPE }
    ? Array<UnwrapTypeRef<Type['type'], Introspection>>
    : Type extends { kind: Kind.NAMED_TYPE; name: { kind: Kind.NAME; value: infer Name } }
      ? Name extends keyof Introspection['types']
        ? ScalarType<Name, Introspection>
        : unknown
      : never;

type UnwrapTypeRef<
  Type extends TypeNode,
  Introspection extends IntrospectionLikeType,
> = Type extends { kind: Kind.NON_NULL_TYPE }
  ? UnwrapTypeRefInner<Type['type'], Introspection>
  : null | UnwrapTypeRefInner<Type, Introspection>;

type VariablesContinue<
  Variables extends readonly unknown[],
  Introspection extends IntrospectionLikeType,
> = Variables extends [infer Variable, ...infer Rest]
  ? (Variable extends { kind: Kind.VARIABLE_DEFINITION; variable: any; type: any }
      ? Variable extends { defaultValue: undefined }
        ? {
            [Name in Variable['variable']['name']['value']]: UnwrapTypeRef<
              Variable['type'],
              Introspection
            >;
          }
        : {
            [Name in Variable['variable']['name']['value']]?: UnwrapTypeRef<
              Variable['type'],
              Introspection
            >;
          }
      : {}) &
      VariablesContinue<Rest, Introspection>
  : {};

type DefinitionContinue<
  Definitions extends readonly unknown[],
  Introspection extends IntrospectionLikeType,
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
  I extends IntrospectionLikeType,
> = Obj<DefinitionContinue<D['definitions'], I>>;
