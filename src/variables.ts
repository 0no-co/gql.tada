import type { Kind } from '@0no-co/graphql.web';
import type { SchemaLike } from './introspection';
import type { DocumentNodeLike } from './parser';
import type { obj } from './utils';

type isRequiredInputField<InputField> = InputField extends {
  defaultValue?: undefined | null;
  type: { kind: 'NON_NULL' };
}
  ? true
  : false;

type getInputObjectType<InputFields, Introspection extends SchemaLike> = obj<
  {
    [Name in keyof InputFields as isRequiredInputField<InputFields[Name]> extends true
      ? Name
      : never]: InputFields[Name] extends { type: any }
      ? unwrapTypeRec<InputFields[Name]['type'], Introspection, true>
      : never;
  } & {
    [Name in keyof InputFields as isRequiredInputField<InputFields[Name]> extends true
      ? never
      : Name]?: InputFields[Name] extends { type: any }
      ? unwrapTypeRec<InputFields[Name]['type'], Introspection, true> | null
      : never;
  }
>;

type getInputObjectTypeOneOf<
  InputFields,
  Introspection extends SchemaLike,
  Name = keyof InputFields,
> = Name extends keyof InputFields
  ? {
      [P in Name]: InputFields[Name] extends { type: any }
        ? unwrapTypeRec<InputFields[Name]['type'], Introspection, false>
        : never;
    }
  : never;

// NOTE: `any` must not be unwrapped, since it'd otherwise recurse infinitely
type unwrapTypeRec<TypeRef, Introspection extends SchemaLike, IsOptional> = 0 extends 1 & TypeRef
  ? any
  : TypeRef extends {
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
          ? getScalarType<TypeRef['name'], Introspection>
          : null | getScalarType<TypeRef['name'], Introspection>
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
        ? getScalarType<Type['name']['value'], Introspection>
        : null | getScalarType<Type['name']['value'], Introspection>
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
  : obj<VariablesObject>;

type getVariablesType<
  Document extends DocumentNodeLike,
  Introspection extends SchemaLike,
> = _getVariablesRec<Document['definitions'][0]['variableDefinitions'], Introspection>;

type getScalarType<
  TypeName,
  Introspection extends SchemaLike,
> = TypeName extends keyof Introspection['types']
  ? Introspection['types'][TypeName] extends {
      kind: 'INPUT_OBJECT';
      inputFields: any;
      isOneOf?: any;
    }
    ? Introspection['types'][TypeName]['isOneOf'] extends true
      ? getInputObjectTypeOneOf<Introspection['types'][TypeName]['inputFields'], Introspection>
      : getInputObjectType<Introspection['types'][TypeName]['inputFields'], Introspection>
    : Introspection['types'][TypeName] extends { type: any }
      ? Introspection['types'][TypeName]['type']
      : Introspection['types'][TypeName]['enumValues']
  : never;

export type { getVariablesType, getScalarType };
