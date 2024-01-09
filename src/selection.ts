import type {
  Kind,
  FieldNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  NameNode,
} from '@0no-co/graphql.web';

import type { tada } from './namespace';
import type { Obj, ObjValues } from './utils';
import type { FragmentMap } from './fragments';

import type {
  IntrospectionField,
  IntrospectionListTypeRef,
  IntrospectionNamedTypeRef,
  IntrospectionNonNullTypeRef,
  IntrospectionTypeRef,
} from './introspection';

type ObjectLikeType = {
  kind: 'OBJECT' | 'INTERFACE' | 'UNION';
  name: string;
  fields: { [key: string]: IntrospectionField };
};

type IntrospectionLikeType = {
  query: string;
  mutation: string | never;
  subscription: string | never;
  types: { [name: string]: any };
};

type UnwrapTypeInner<
  Type extends IntrospectionTypeRef,
  SelectionSet extends { kind: Kind.SELECTION_SET } | undefined,
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any },
> = Type extends IntrospectionNonNullTypeRef
  ? UnwrapTypeInner<Type['ofType'], SelectionSet, Introspection, Fragments>
  : Type extends IntrospectionListTypeRef
    ? Array<UnwrapType<Type['ofType'], SelectionSet, Introspection, Fragments>>
    : Type extends IntrospectionNamedTypeRef
      ? Introspection['types'][Type['name']] extends ObjectLikeType
        ? SelectionSet extends { kind: Kind.SELECTION_SET; selections: any }
          ? Selection<
              SelectionSet['selections'],
              Introspection['types'][Type['name']],
              Introspection,
              Fragments
            >
          : {}
        : Introspection['types'][Type['name']]['type']
      : unknown;

type UnwrapType<
  Type extends IntrospectionTypeRef,
  SelectionSet extends { kind: Kind.SELECTION_SET } | undefined,
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any },
> = Type extends IntrospectionNonNullTypeRef
  ? UnwrapTypeInner<Type['ofType'], SelectionSet, Introspection, Fragments>
  : null | UnwrapTypeInner<Type, SelectionSet, Introspection, Fragments>;

type ShouldInclude<Directives extends readonly unknown[] | undefined> =
  Directives extends readonly [infer Directive, ...infer Rest]
    ? Directive extends { kind: Kind.DIRECTIVE; name: any }
      ? Directive['name']['value'] extends 'include' | 'skip' | 'defer'
        ? false
        : ShouldInclude<Rest>
      : ShouldInclude<Rest>
    : true;

type FieldAlias<Field extends FieldNode> = Field['alias'] extends undefined
  ? Field['name']['value']
  : Field['alias'] extends NameNode
    ? Field['alias']['value']
    : never;

type FragmentSelection<
  Node extends { kind: Kind.FRAGMENT_SPREAD | Kind.INLINE_FRAGMENT },
  Type extends ObjectLikeType,
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any },
> = Node extends { kind: Kind.INLINE_FRAGMENT; selectionSet: any }
  ? Selection<Node['selectionSet']['selections'], Type, Introspection, Fragments>
  : Node extends { kind: Kind.FRAGMENT_SPREAD; name: any }
    ? Node['name']['value'] extends keyof Fragments
      ? Fragments[Node['name']['value']] extends infer Fragment extends {
          [tada.fragmentName]: string;
        }
        ? { [tada.fragmentRefs]: { [Name in Fragment[tada.fragmentName]]: Fragment } }
        : Selection<
            Fragments[Node['name']['value']]['selectionSet']['selections'],
            Type,
            Introspection,
            Fragments
          >
      : {}
    : {};

type FragmentSpreadType<
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
      : never
    : never;

type TypenameOfType<Type extends ObjectLikeType> = Type extends {
  kind: 'UNION' | 'INTERFACE';
  possibleTypes: any;
}
  ? Type['possibleTypes']
  : Type['name'];

export type Selection<
  Selections extends readonly any[],
  Type extends ObjectLikeType,
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any },
> = Obj<
  FieldSelectionContinue<Selections, Type, Introspection, Fragments> &
    FragmentsSelection<Selections, Type, Introspection, Fragments>
>;

type FieldSelectionContinue<
  Selections extends readonly unknown[],
  Type extends ObjectLikeType,
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any },
> = Selections extends readonly [infer Selection, ...infer Rest]
  ? (Selection extends FieldNode
      ? ShouldInclude<Selection['directives']> extends true
        ? {
            [Prop in FieldAlias<Selection>]: Selection['name']['value'] extends '__typename'
              ? TypenameOfType<Type>
              : UnwrapType<
                  Type['fields'][Selection['name']['value']]['type'],
                  Selection['selectionSet'],
                  Introspection,
                  Fragments
                >;
          }
        : {
            [Prop in FieldAlias<Selection>]?: Selection['name']['value'] extends '__typename'
              ? TypenameOfType<Type>
              : UnwrapType<
                  Type['fields'][Selection['name']['value']]['type'],
                  Selection['selectionSet'],
                  Introspection,
                  Fragments
                >;
          }
      : {}) &
      FieldSelectionContinue<Rest, Type, Introspection, Fragments>
  : {};

type FragmentsSelection<
  Selections extends readonly unknown[],
  Type extends ObjectLikeType,
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any },
> = Type extends { kind: 'UNION' | 'INTERFACE'; possibleTypes: any }
  ? ObjValues<{
      [PossibleType in Type['possibleTypes']]: FragmentSelectionContinue<
        Selections,
        PossibleType,
        Type,
        Introspection,
        Fragments
      >;
    }>
  : Type extends { kind: 'OBJECT'; name: any }
    ? FragmentSelectionContinue<Selections, Type['name'], Type, Introspection, Fragments>
    : {};

type FragmentSelectionContinue<
  Selections extends readonly unknown[],
  PossibleType extends string,
  Type extends ObjectLikeType,
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any },
> = Selections extends [infer Node, ...infer Rest]
  ? (Node extends FragmentSpreadNode | InlineFragmentNode
      ? FragmentSpreadType<Node, Type, Introspection, Fragments> extends infer Subtype extends
          ObjectLikeType
        ? PossibleType extends Subtype['name'] | TypenameOfType<Subtype>
          ?
              | (ShouldInclude<Node['directives']> extends true ? never : {})
              | FragmentSelection<Node, Subtype, Introspection, Fragments>
          : {}
        : {}
      : {}) &
      FragmentSelectionContinue<Rest, PossibleType, Type, Introspection, Fragments>
  : {};

type DefinitionContinue<
  Definitions extends any[],
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any },
> = Definitions extends readonly [infer Definition, ...infer Rest]
  ? Definition extends {
      kind: Kind.OPERATION_DEFINITION;
      selectionSet: { kind: Kind.SELECTION_SET; selections: [...infer Selections] };
      operation: any;
    }
    ? Introspection['types'][Introspection[Definition['operation']]] extends ObjectLikeType
      ? Selection<
          Selections,
          Introspection['types'][Introspection[Definition['operation']]],
          Introspection,
          Fragments
        >
      : {}
    : DefinitionContinue<Rest, Introspection, Fragments>
  : {};

export type TypedDocument<
  Document extends { kind: Kind.DOCUMENT; definitions: any[] },
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any } = {},
> = DefinitionContinue<Document['definitions'], Introspection, FragmentMap<Document> & Fragments>;

export type FragmentType<
  Document extends { kind: Kind.DOCUMENT; definitions: any[] },
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any } = {},
> = Document['definitions'][0] extends {
  kind: Kind.FRAGMENT_DEFINITION;
  typeCondition: { name: { value: infer TypeName } };
}
  ? TypeName extends keyof Introspection['types']
    ? Introspection['types'][TypeName] extends ObjectLikeType
      ? Selection<
          Document['definitions'][0]['selectionSet']['selections'],
          Introspection['types'][TypeName],
          Introspection,
          FragmentMap<Document> & Fragments
        >
      : never
    : never
  : never;
