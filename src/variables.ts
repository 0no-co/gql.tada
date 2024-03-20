import type { Kind } from '@0no-co/graphql.web';
import type { SchemaLike } from './introspection';
import type { DocumentNodeLike } from './parser';
import type { obj } from './utils';

type getInputObjectTypeRec<
  InputFields,
  Introspection extends SchemaLike,
  InputObject = {},
> = InputFields extends [infer InputField, ...infer Rest]
  ? getInputObjectTypeRec<
      Rest,
      Introspection,
      (InputField extends { name: any; type: any }
        ? InputField extends { defaultValue?: undefined | null; type: { kind: 'NON_NULL' } }
          ? { [Name in InputField['name']]: unwrapTypeRec<InputField['type'], Introspection, true> }
          : {
              [Name in InputField['name']]?: unwrapTypeRec<
                InputField['type'],
                Introspection,
                true
              > | null;
            }
        : {}) &
        InputObject
    >
  : InputObject;

type unwrapTypeRec<TypeRef, Introspection extends SchemaLike, IsOptional> = TypeRef extends {
  kind: 'NON_NULL';
  ofType: any;
}
  ? unwrapTypeRec<TypeRef['ofType'], Introspection, false>
  : TypeRef extends { kind: 'LIST'; ofType: any }
    ? IsOptional extends false
      ? Array<unwrapTypeRec<TypeRef['ofType'], Introspection, true>>
      : null | Array<unwrapTypeRec<TypeRef['ofType'], Introspection, true>>
    : TypeRef extends { name: any }
      ? IsOptional extends false
        ? _getScalarType<TypeRef['name'], Introspection>
        : null | _getScalarType<TypeRef['name'], Introspection>
      : unknown;

type unwrapTypeRefRec<Type, Introspection extends SchemaLike, IsOptional> = Type extends {
  kind: Kind.NON_NULL_TYPE;
  type: any;
}
  ? unwrapTypeRefRec<Type['type'], Introspection, false>
  : Type extends { kind: Kind.LIST_TYPE; type: any }
    ? IsOptional extends false
      ? Array<unwrapTypeRefRec<Type['type'], Introspection, true>>
      : null | Array<unwrapTypeRefRec<Type['type'], Introspection, true>>
    : Type extends { kind: Kind.NAMED_TYPE; name: any }
      ? IsOptional extends false
        ? _getScalarType<Type['name']['value'], Introspection>
        : null | _getScalarType<Type['name']['value'], Introspection>
      : unknown;

type _getVariablesRec<
  Variables,
  Introspection extends SchemaLike,
  VariablesObject = {},
> = Variables extends [infer Variable, ...infer Rest]
  ? _getVariablesRec<
      Rest,
      Introspection,
      (Variable extends { kind: Kind.VARIABLE_DEFINITION; variable: any; type: any }
        ? Variable extends { defaultValue: undefined; type: { kind: Kind.NON_NULL_TYPE } }
          ? {
              [Name in Variable['variable']['name']['value']]: unwrapTypeRefRec<
                Variable['type'],
                Introspection,
                true
              >;
            }
          : {
              [Name in Variable['variable']['name']['value']]?: unwrapTypeRefRec<
                Variable['type'],
                Introspection,
                true
              >;
            }
        : {}) &
        VariablesObject
    >
  : VariablesObject;

type getVariablesType<
  Document extends DocumentNodeLike,
  Introspection extends SchemaLike,
> = Document['definitions'][0] extends {
  kind: Kind.OPERATION_DEFINITION;
  variableDefinitions: any;
}
  ? obj<_getVariablesRec<Document['definitions'][0]['variableDefinitions'], Introspection>>
  : {};

type _getScalarType<
  TypeName,
  Introspection extends SchemaLike,
> = TypeName extends keyof Introspection['types']
  ? Introspection['types'][TypeName] extends { kind: 'SCALAR' | 'ENUM'; type: any }
    ? Introspection['types'][TypeName]['type']
    : Introspection['types'][TypeName] extends { kind: 'INPUT_OBJECT'; inputFields: any }
      ? obj<getInputObjectTypeRec<Introspection['types'][TypeName]['inputFields'], Introspection>>
      : never
  : unknown;

type getScalarType<
  TypeName,
  Introspection extends SchemaLike,
  OrType = never,
> = TypeName extends keyof Introspection['types']
  ? Introspection['types'][TypeName] extends { kind: 'SCALAR' | 'ENUM'; type: any }
    ? Introspection['types'][TypeName]['type'] | OrType
    : Introspection['types'][TypeName] extends { kind: 'INPUT_OBJECT'; inputFields: any }
      ?
          | obj<
              getInputObjectTypeRec<Introspection['types'][TypeName]['inputFields'], Introspection>
            >
          | OrType
      : never
  : never;

export type { getVariablesType, getScalarType };
