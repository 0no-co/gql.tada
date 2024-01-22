import type { Kind } from '@0no-co/graphql.web';

import type { obj, objValues } from './utils';
import type { DocumentNodeLike } from './parser';

import type { $tada, makeUndefinedFragmentRef } from './namespace';
import type { IntrospectionLikeType } from './introspection';

type ObjectLikeType = {
  kind: 'OBJECT' | 'INTERFACE' | 'UNION';
  name: string;
  fields: { [key: string]: any };
};

type _unwrapTypeRec<
  Type,
  SelectionSet,
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any },
> = Type extends { readonly kind: 'NON_NULL'; readonly ofType: any }
  ? _unwrapTypeRec<Type['ofType'], SelectionSet, Introspection, Fragments>
  : Type extends { readonly kind: 'LIST'; readonly ofType: any }
    ? Array<unwrapType<Type['ofType'], SelectionSet, Introspection, Fragments>>
    : Type extends { readonly name: string }
      ? Introspection['types'][Type['name']] extends ObjectLikeType
        ? SelectionSet extends { kind: Kind.SELECTION_SET; selections: any }
          ? getSelection<
              SelectionSet['selections'],
              Introspection['types'][Type['name']],
              Introspection,
              Fragments
            >
          : unknown
        : Introspection['types'][Type['name']]['type']
      : unknown;

type unwrapType<
  Type,
  SelectionSet,
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any },
  TypeDirective = void,
> = Type extends { readonly kind: 'NON_NULL'; readonly ofType: any }
  ? TypeDirective extends 'optional'
    ? null | _unwrapTypeRec<Type['ofType'], SelectionSet, Introspection, Fragments>
    : _unwrapTypeRec<Type['ofType'], SelectionSet, Introspection, Fragments>
  : TypeDirective extends 'required'
    ? _unwrapTypeRec<Type, SelectionSet, Introspection, Fragments>
    : null | _unwrapTypeRec<Type, SelectionSet, Introspection, Fragments>;

type getTypeDirective<Node> = Node extends { directives: any[] }
  ? Node['directives'][number]['name']['value'] & ('required' | '_required') extends never
    ? Node['directives'][number]['name']['value'] & ('optional' | '_optional') extends never
      ? void
      : 'optional'
    : 'required'
  : void;

type isOptional<Node> = Node extends { directives: any[] }
  ? Node['directives'][number]['name']['value'] & ('include' | 'skip' | 'defer') extends never
    ? false
    : true
  : false;

type getFieldAlias<Node> = Node extends { alias: undefined; name: any }
  ? Node['name']['value']
  : Node extends { alias: any }
    ? Node['alias']['value']
    : never;

type getFragmentSelection<
  Node,
  Type extends ObjectLikeType,
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any },
> = Node extends { kind: Kind.INLINE_FRAGMENT; selectionSet: any }
  ? getSelection<Node['selectionSet']['selections'], Type, Introspection, Fragments>
  : Node extends { kind: Kind.FRAGMENT_SPREAD; name: any }
    ? Node['name']['value'] extends keyof Fragments
      ? Fragments[Node['name']['value']] extends { [$tada.ref]: any }
        ? Fragments[Node['name']['value']][$tada.ref]
        : getSelection<
            Fragments[Node['name']['value']]['selectionSet']['selections'],
            Type,
            Introspection,
            Fragments
          >
      : {}
    : {};

type getSpreadSubtype<
  Node,
  BaseType extends ObjectLikeType,
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any },
> = Node extends { kind: Kind.INLINE_FRAGMENT; typeCondition?: any }
  ? Node['typeCondition'] extends { kind: Kind.NAMED_TYPE; name: any }
    ? Introspection['types'][Node['typeCondition']['name']['value']]
    : BaseType
  : Node extends { kind: Kind.FRAGMENT_SPREAD; name: any }
    ? Node['name']['value'] extends keyof Fragments
      ? Introspection['types'][Fragments[Node['name']['value']]['typeCondition']['name']['value']]
      : void
    : void;

type getTypenameOfType<Type> =
  | (Type extends { name: any } ? Type['name'] : never)
  | (Type extends { possibleTypes: any } ? Type['possibleTypes'] : never);

type getSelection<
  Selections,
  Type extends ObjectLikeType,
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any },
> = obj<
  Type extends { kind: 'UNION' | 'INTERFACE'; possibleTypes: any }
    ? objValues<{
        [PossibleType in Type['possibleTypes']]: _getPossibleTypeSelectionRec<
          Selections,
          PossibleType,
          Type,
          Introspection,
          Fragments
        >;
      }>
    : Type extends { kind: 'OBJECT'; name: any }
      ? _getPossibleTypeSelectionRec<Selections, Type['name'], Type, Introspection, Fragments>
      : {}
>;

type _getPossibleTypeSelectionRec<
  Selections,
  PossibleType extends string,
  Type extends ObjectLikeType,
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any },
> = Selections extends [infer Node, ...infer Rest]
  ? (Node extends { kind: Kind.FRAGMENT_SPREAD | Kind.INLINE_FRAGMENT }
      ? getSpreadSubtype<Node, Type, Introspection, Fragments> extends infer Subtype extends
          ObjectLikeType
        ? PossibleType extends getTypenameOfType<Subtype>
          ?
              | (isOptional<Node> extends true ? {} : never)
              | getFragmentSelection<Node, Subtype, Introspection, Fragments>
          : {}
        : Node extends { kind: Kind.FRAGMENT_SPREAD; name: any }
          ? makeUndefinedFragmentRef<Node['name']['value']>
          : {}
      : Node extends { kind: Kind.FIELD; name: any; selectionSet: any }
        ? isOptional<Node> extends true
          ? {
              [Prop in getFieldAlias<Node>]?: Node['name']['value'] extends '__typename'
                ? PossibleType
                : unwrapType<
                    Type['fields'][Node['name']['value']]['type'],
                    Node['selectionSet'],
                    Introspection,
                    Fragments,
                    getTypeDirective<Node>
                  >;
            }
          : {
              [Prop in getFieldAlias<Node>]: Node['name']['value'] extends '__typename'
                ? PossibleType
                : unwrapType<
                    Type['fields'][Node['name']['value']]['type'],
                    Node['selectionSet'],
                    Introspection,
                    Fragments,
                    getTypeDirective<Node>
                  >;
            }
        : {}) &
      _getPossibleTypeSelectionRec<Rest, PossibleType, Type, Introspection, Fragments>
  : {};

type getOperationSelectionType<
  Definition,
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any },
> = Definition extends {
  kind: Kind.OPERATION_DEFINITION;
  selectionSet: any;
  operation: any;
}
  ? Introspection['types'][Introspection[Definition['operation']]] extends infer Type extends
      ObjectLikeType
    ? getSelection<Definition['selectionSet']['selections'], Type, Introspection, Fragments>
    : {}
  : never;

type getFragmentSelectionType<
  Definition,
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any },
> = Definition extends {
  kind: Kind.FRAGMENT_DEFINITION;
  selectionSet: any;
  typeCondition: any;
}
  ? Introspection['types'][Definition['typeCondition']['name']['value']] extends infer Type extends
      ObjectLikeType
    ? getSelection<Definition['selectionSet']['selections'], Type, Introspection, Fragments>
    : never
  : never;

type getDocumentType<
  Document extends DocumentNodeLike,
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any } = {},
> = Document['definitions'] extends readonly [infer Definition, ...infer Rest]
  ? Definition extends { kind: Kind.OPERATION_DEFINITION }
    ? getOperationSelectionType<Definition, Introspection, getFragmentMapRec<Rest> & Fragments>
    : Definition extends { kind: Kind.FRAGMENT_DEFINITION }
      ? getFragmentSelectionType<Definition, Introspection, getFragmentMapRec<Rest> & Fragments>
      : never
  : never;

type getFragmentMapRec<Definitions> = Definitions extends readonly [infer Definition, ...infer Rest]
  ? (Definition extends { kind: Kind.FRAGMENT_DEFINITION; name: any }
      ? { [Name in Definition['name']['value']]: Definition }
      : {}) &
      getFragmentMapRec<Rest>
  : {};

export type { getDocumentType, getFragmentMapRec };
