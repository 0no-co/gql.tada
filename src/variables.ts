import type { Kind } from '@0no-co/graphql.web';
import type { IntrospectionLikeType } from './introspection';
import type { DocumentNodeLike, parseType } from './parser';
import type { obj } from './utils';

type getInputObjectTypeRec<
  InputFields,
  Introspection extends IntrospectionLikeType,
> = InputFields extends [infer InputField, ...infer Rest]
  ? (InputField extends { name: any; type: any }
      ? InputField['type'] extends { kind: 'NON_NULL' }
        ? { [Name in InputField['name']]: unwrapType<InputField['type'], Introspection> }
        : { [Name in InputField['name']]?: unwrapType<InputField['type'], Introspection> }
      : {}) &
      getInputObjectTypeRec<Rest, Introspection>
  : {};

type getScalarType<
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
      ? getScalarType<TypeRef['name'], Introspection>
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
      ? getScalarType<Type['name']['value'], Introspection>
      : unknown;

type unwrapTypeRef<Type, Introspection extends IntrospectionLikeType> = Type extends {
  kind: Kind.NON_NULL_TYPE;
  type: any;
}
  ? _unwrapTypeRefRec<Type['type'], Introspection>
  : null | _unwrapTypeRefRec<Type, Introspection>;

type getVariablesRec<Variables, Introspection extends IntrospectionLikeType> = Variables extends [
  infer Variable,
  ...infer Rest,
]
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

type getVarDefsRec<Arguments, Introspection extends IntrospectionLikeType> = Arguments extends [
  infer Argument,
  ...infer Rest,
]
  ? (Argument extends {
      kind: Kind.ARGUMENT;
      name: any;
      value: { kind: Kind.STRING; value: string };
    }
      ? {
          [Name in Argument['name']['value']]: unwrapTypeRef<
            parseType<Argument['value']['value']>,
            Introspection
          >;
        }
      : {}) &
      getVariablesRec<Rest, Introspection>
  : {};

type getVarDefDirectiveRec<
  Directives extends readonly any[],
  Introspection extends IntrospectionLikeType,
> = Directives extends readonly [infer Directive, ...infer Rest]
  ? Directive extends {
      kind: Kind.DIRECTIVE;
      name: { kind: Kind.NAME; value: '_variables' };
      arguments: any[];
    }
    ? getVarDefsRec<Directive['arguments'], Introspection>
    : getVarDefDirectiveRec<Rest, Introspection>
  : {};

type getVariablesType<
  Document extends DocumentNodeLike,
  Introspection extends IntrospectionLikeType,
> = obj<
  Document['definitions'][0] extends {
    kind: Kind.OPERATION_DEFINITION;
    variableDefinitions: any[];
  }
    ? getVariablesRec<Document['definitions'][0]['variableDefinitions'], Introspection>
    : Document['definitions'][0] extends {
          kind: Kind.FRAGMENT_DEFINITION;
          directives: any[];
        }
      ? getVarDefDirectiveRec<Document['definitions'][0]['directives'], Introspection>
      : {}
>;

export type { getVariablesType };
