import type {
  Kind,
  FieldNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  NameNode,
} from '@0no-co/graphql.web';

import type { obj, objValues } from './utils';
import type { DocumentNodeLike } from './parser';

import type {
  FragmentDefDecorationLike,
  makeUndefinedFragmentRef,
  makeFragmentRef,
} from './namespace';

import type {
  IntrospectionField,
  IntrospectionListTypeRef,
  IntrospectionNamedTypeRef,
  IntrospectionNonNullTypeRef,
  IntrospectionTypeRef,
  IntrospectionLikeType,
} from './introspection';

type ObjectLikeType = {
  kind: 'OBJECT' | 'INTERFACE' | 'UNION';
  name: string;
  fields: { [key: string]: IntrospectionField };
};

type _unwrapTypeRec<
  Type extends IntrospectionTypeRef,
  SelectionSet extends { kind: Kind.SELECTION_SET } | undefined,
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any },
> = Type extends IntrospectionNonNullTypeRef
  ? _unwrapTypeRec<Type['ofType'], SelectionSet, Introspection, Fragments>
  : Type extends IntrospectionListTypeRef
    ? Array<unwrapType<Type['ofType'], SelectionSet, Introspection, Fragments>>
    : Type extends IntrospectionNamedTypeRef
      ? Introspection['types'][Type['name']] extends ObjectLikeType
        ? SelectionSet extends { kind: Kind.SELECTION_SET; selections: any }
          ? getSelection<
              SelectionSet['selections'],
              Introspection['types'][Type['name']],
              Introspection,
              Fragments
            >
          : {}
        : Introspection['types'][Type['name']]['type']
      : unknown;

type unwrapType<
  Type extends IntrospectionTypeRef,
  SelectionSet extends { kind: Kind.SELECTION_SET } | undefined,
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any },
> = Type extends IntrospectionNonNullTypeRef
  ? _unwrapTypeRec<Type['ofType'], SelectionSet, Introspection, Fragments>
  : null | _unwrapTypeRec<Type, SelectionSet, Introspection, Fragments>;

type isOptionalRec<Directives extends readonly unknown[] | undefined> =
  Directives extends readonly [infer Directive, ...infer Rest]
    ? Directive extends { kind: Kind.DIRECTIVE; name: any }
      ? Directive['name']['value'] extends 'include' | 'skip' | 'defer'
        ? false
        : isOptionalRec<Rest>
      : isOptionalRec<Rest>
    : true;

type getFieldAlias<Node extends FieldNode> = Node['alias'] extends undefined
  ? Node['name']['value']
  : Node['alias'] extends NameNode
    ? Node['alias']['value']
    : never;

type getFragmentSelection<
  Node extends { kind: Kind.FRAGMENT_SPREAD | Kind.INLINE_FRAGMENT },
  Type extends ObjectLikeType,
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any },
> = Node extends { kind: Kind.INLINE_FRAGMENT; selectionSet: any }
  ? getSelection<Node['selectionSet']['selections'], Type, Introspection, Fragments>
  : Node extends { kind: Kind.FRAGMENT_SPREAD; name: any }
    ? Node['name']['value'] extends keyof Fragments
      ? Fragments[Node['name']['value']] extends FragmentDefDecorationLike
        ? makeFragmentRef<Fragments[Node['name']['value']]>
        : getSelection<
            Fragments[Node['name']['value']]['selectionSet']['selections'],
            Type,
            Introspection,
            Fragments
          >
      : {}
    : {};

type getSpreadSubtype<
  Node extends { kind: Kind.FRAGMENT_SPREAD | Kind.INLINE_FRAGMENT },
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

type getTypenameOfType<Type extends ObjectLikeType> = Type extends {
  possibleTypes: any;
}
  ? Type['possibleTypes']
  : Type['name'];

type getSelection<
  Selections extends readonly any[],
  Type extends ObjectLikeType,
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any },
> = obj<
  getFieldsSelectionRec<Selections, Type, Introspection, Fragments> &
    getFragmentsSelection<Selections, Type, Introspection, Fragments>
>;

type getFieldsSelectionRec<
  Selections extends readonly unknown[],
  Type extends ObjectLikeType,
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any },
> = Selections extends readonly [infer Selection, ...infer Rest]
  ? (Selection extends FieldNode
      ? isOptionalRec<Selection['directives']> extends true
        ? {
            [Prop in getFieldAlias<Selection>]: Selection['name']['value'] extends '__typename'
              ? getTypenameOfType<Type>
              : unwrapType<
                  Type['fields'][Selection['name']['value']]['type'],
                  Selection['selectionSet'],
                  Introspection,
                  Fragments
                >;
          }
        : {
            [Prop in getFieldAlias<Selection>]?: Selection['name']['value'] extends '__typename'
              ? getTypenameOfType<Type>
              : unwrapType<
                  Type['fields'][Selection['name']['value']]['type'],
                  Selection['selectionSet'],
                  Introspection,
                  Fragments
                >;
          }
      : {}) &
      getFieldsSelectionRec<Rest, Type, Introspection, Fragments>
  : {};

type _getFragmentsSelectionRec<
  Selections extends readonly unknown[],
  PossibleType extends string,
  Type extends ObjectLikeType,
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any },
> = Selections extends [infer Node, ...infer Rest]
  ? (Node extends FragmentSpreadNode | InlineFragmentNode
      ? getSpreadSubtype<Node, Type, Introspection, Fragments> extends infer Subtype extends
          ObjectLikeType
        ? PossibleType extends Subtype['name'] | getTypenameOfType<Subtype>
          ?
              | (isOptionalRec<Node['directives']> extends true ? never : {})
              | getFragmentSelection<Node, Subtype, Introspection, Fragments>
          : {}
        : Node extends FragmentSpreadNode
          ? makeUndefinedFragmentRef<Node['name']['value']>
          : {}
      : {}) &
      _getFragmentsSelectionRec<Rest, PossibleType, Type, Introspection, Fragments>
  : {};

type getFragmentsSelection<
  Selections extends readonly unknown[],
  Type extends ObjectLikeType,
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any },
> = Type extends { kind: 'UNION' | 'INTERFACE'; possibleTypes: any }
  ? objValues<{
      [PossibleType in Type['possibleTypes']]: _getFragmentsSelectionRec<
        Selections,
        PossibleType,
        Type,
        Introspection,
        Fragments
      >;
    }>
  : Type extends { kind: 'OBJECT'; name: any }
    ? _getFragmentsSelectionRec<Selections, Type['name'], Type, Introspection, Fragments>
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
