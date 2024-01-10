import type { Kind, TypeNode } from '@0no-co/graphql.web';
import type { IntrospectionLikeType } from './introspection';
import type { obj } from './utils';

type getInputObjectTypeRec<
  InputFields extends readonly unknown[],
  Introspection extends IntrospectionLikeType,
> = InputFields extends [infer InputField, ...infer Rest]
  ? (InputField extends { name: any; type: any }
      ? { [Name in InputField['name']]: unwrapType<InputField['type'], Introspection> }
      : {}) &
      getInputObjectTypeRec<Rest, Introspection>
  : {};

type getScalarType<
  TypeName extends string,
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
      ? obj<getInputObjectTypeRec<InputFields, Introspection>>
      : never
  : unknown;

type _unwrapTypeRec<
  TypeRef extends TypeNode,
  Introspection extends IntrospectionLikeType,
> = TypeRef extends { kind: 'NON_NULL' }
  ? _unwrapTypeRec<TypeRef['ofType'], Introspection>
  : TypeRef extends { kind: 'LIST' }
    ? Array<unwrapType<TypeRef['ofType'], Introspection>>
    : TypeRef extends { name: any }
      ? getScalarType<TypeRef['name'], Introspection>
      : unknown;

type unwrapType<Type extends TypeNode, Introspection extends IntrospectionLikeType> = Type extends {
  kind: 'NON_NULL';
}
  ? _unwrapTypeRec<Type['ofType'], Introspection>
  : null | _unwrapTypeRec<Type, Introspection>;

type _nwrapTypeRefRec<
  Type extends TypeNode,
  Introspection extends IntrospectionLikeType,
> = Type extends { kind: Kind.NON_NULL_TYPE }
  ? _nwrapTypeRefRec<Type['type'], Introspection>
  : Type extends { kind: Kind.LIST_TYPE }
    ? Array<unwrapTypeRef<Type['type'], Introspection>>
    : Type extends { kind: Kind.NAMED_TYPE; name: any }
      ? getScalarType<Type['name']['value'], Introspection>
      : unknown;

type unwrapTypeRef<
  Type extends TypeNode,
  Introspection extends IntrospectionLikeType,
> = Type extends { kind: Kind.NON_NULL_TYPE }
  ? _nwrapTypeRefRec<Type['type'], Introspection>
  : null | _nwrapTypeRefRec<Type, Introspection>;

type getVariablesRec<
  Variables extends readonly unknown[],
  Introspection extends IntrospectionLikeType,
> = Variables extends [infer Variable, ...infer Rest]
  ? (Variable extends { kind: Kind.VARIABLE_DEFINITION; variable: any; type: any }
      ? Variable extends { defaultValue: undefined }
        ? {
            [Name in Variable['variable']['name']['value']]: unwrapTypeRef<
              Variable['type'],
              Introspection
            >;
          }
        : {
            [Name in Variable['variable']['name']['value']]?: unwrapTypeRef<
              Variable['type'],
              Introspection
            >;
          }
      : {}) &
      getVariablesRec<Rest, Introspection>
  : {};

type getDefinitionVariablesRec<
  Definitions extends readonly unknown[],
  Introspection extends IntrospectionLikeType,
> = (Definitions[0] extends {
  kind: Kind.OPERATION_DEFINITION;
  variableDefinitions: infer VarDefs;
}
  ? VarDefs extends Array<{ kind: Kind.VARIABLE_DEFINITION }>
    ? getVariablesRec<VarDefs, Introspection>
    : never
  : never) &
  (Definitions extends readonly [any, ...infer Rest]
    ? Rest extends readonly []
      ? {}
      : getDefinitionVariablesRec<Rest, Introspection>
    : never);

type getVariablesType<
  D extends { kind: Kind.DOCUMENT; definitions: any[] },
  I extends IntrospectionLikeType,
> = obj<getDefinitionVariablesRec<D['definitions'], I>>;

export type { getVariablesType };
