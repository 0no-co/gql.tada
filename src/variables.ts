import type { Kind } from '@0no-co/graphql.web';
import type { IntrospectionLikeType } from './introspection';
import type { DocumentNodeLike } from './parser';
import type { obj } from './utils';

type getInputObjectTypeRec<
  InputFields,
  Introspection extends IntrospectionLikeType,
  InputObject = {},
> = InputFields extends [infer InputField, ...infer Rest]
  ? getInputObjectTypeRec<
      Rest,
      Introspection,
      (InputField extends { name: any; type: any }
        ? InputField extends { defaultValue: undefined | null; type: { kind: 'NON_NULL' } }
          ? { [Name in InputField['name']]: unwrapType<InputField['type'], Introspection> }
          : { [Name in InputField['name']]?: unwrapType<InputField['type'], Introspection> | null }
        : {}) &
        InputObject
    >
  : InputObject;

type _getScalarType<
  TypeName,
  Introspection extends IntrospectionLikeType,
> = TypeName extends keyof Introspection['types']
  ? Introspection['types'][TypeName] extends { kind: 'SCALAR' | 'ENUM'; type: any }
    ? Introspection['types'][TypeName]['type']
    : Introspection['types'][TypeName] extends { kind: 'INPUT_OBJECT'; inputFields: any }
      ? obj<getInputObjectTypeRec<Introspection['types'][TypeName]['inputFields'], Introspection>>
      : never
  : unknown;

type _unwrapTypeRec<TypeRef, Introspection extends IntrospectionLikeType> = TypeRef extends {
  kind: 'NON_NULL';
  ofType: any;
}
  ? _unwrapTypeRec<TypeRef['ofType'], Introspection>
  : TypeRef extends { kind: 'LIST'; ofType: any }
    ? Array<unwrapType<TypeRef['ofType'], Introspection>>
    : TypeRef extends { name: any }
      ? _getScalarType<TypeRef['name'], Introspection>
      : unknown;

type unwrapType<Type, Introspection extends IntrospectionLikeType> = Type extends {
  kind: 'NON_NULL';
  ofType: any;
}
  ? _unwrapTypeRec<Type['ofType'], Introspection>
  : null | _unwrapTypeRec<Type, Introspection>;

type _unwrapTypeRefRec<Type, Introspection extends IntrospectionLikeType> = Type extends {
  kind: Kind.NON_NULL_TYPE;
  type: any;
}
  ? _unwrapTypeRefRec<Type['type'], Introspection>
  : Type extends { kind: Kind.LIST_TYPE; type: any }
    ? Array<unwrapTypeRef<Type['type'], Introspection>>
    : Type extends { kind: Kind.NAMED_TYPE; name: any }
      ? _getScalarType<Type['name']['value'], Introspection>
      : unknown;

type unwrapTypeRef<Type, Introspection extends IntrospectionLikeType> = Type extends {
  kind: Kind.NON_NULL_TYPE;
  type: any;
}
  ? _unwrapTypeRefRec<Type['type'], Introspection>
  : null | _unwrapTypeRefRec<Type, Introspection>;

type _getVariablesRec<
  Variables,
  Introspection extends IntrospectionLikeType,
  VariablesObject = {},
> = Variables extends [infer Variable, ...infer Rest]
  ? _getVariablesRec<
      Rest,
      Introspection,
      (Variable extends { kind: Kind.VARIABLE_DEFINITION; variable: any; type: any }
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
        VariablesObject
    >
  : VariablesObject;

type getVariablesType<
  Document extends DocumentNodeLike,
  Introspection extends IntrospectionLikeType,
> = Document['definitions'][0] extends {
  kind: Kind.OPERATION_DEFINITION;
  variableDefinitions: any;
}
  ? obj<_getVariablesRec<Document['definitions'][0]['variableDefinitions'], Introspection>>
  : {};

type getScalarType<
  TypeName,
  Introspection extends IntrospectionLikeType,
  OrType = never,
> = _getScalarType<TypeName, Introspection> extends infer Type
  ? unknown extends Type
    ? never
    : Type | OrType
  : never;

export type { getVariablesType, getScalarType };
