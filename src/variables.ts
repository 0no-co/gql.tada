import type { Kind, TypeNode } from '@0no-co/graphql.web';
import type { IntrospectionLikeType } from './introspection';
import type { DocumentNodeLike } from './parser';
import type { obj } from './utils';

type getInputObjectTypeRec<
  InputFields extends readonly unknown[],
  Introspection extends IntrospectionLikeType,
> = InputFields extends [infer InputField, ...infer Rest]
  ? (InputField extends { name: any; type: any }
      ? InputField extends { type: { kind: 'NON_NULL' } }
        ? { [Name in InputField['name']]: unwrapType<InputField['type'], Introspection> }
        : { [Name in InputField['name']]?: unwrapType<InputField['type'], Introspection> }
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
      ? Variable extends { defaultValue: undefined; type: { kind: Kind.NON_NULL_TYPE } }
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

type getVariablesType<
  Document extends DocumentNodeLike,
  Introspection extends IntrospectionLikeType,
> = Document['definitions'][0] extends {
  kind: Kind.OPERATION_DEFINITION;
  variableDefinitions: any;
}
  ? obj<getVariablesRec<Document['definitions'][0]['variableDefinitions'], Introspection>>
  : {};

export type { getVariablesType };
