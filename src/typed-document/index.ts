import type {
  Kind,
  FieldNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  NameNode,
} from '@0no-co/graphql.web';

import type {
  Introspection as IntrospectionType,
  IntrospectionField,
  IntrospectionListTypeRef,
  IntrospectionNamedTypeRef,
  IntrospectionNonNullTypeRef,
  IntrospectionTypeRef,
} from '../introspection';

// TODO: Replace
type FragmentDefinitionNode = {
  readonly kind: Kind.FRAGMENT_DEFINITION;
  readonly name: any;
  readonly typeCondition: any;
  readonly selectionSet: any;
};

import type { Obj, ObjValues } from '../utils';

export type ObjectLikeType = {
  kind: 'OBJECT' | 'INTERFACE' | 'UNION';
  name: string;
  fields: { [key: string]: IntrospectionField };
};

type UnwrapTypeInner<
  Type extends IntrospectionTypeRef,
  SelectionSet extends { kind: Kind.SELECTION_SET } | undefined,
  Introspection extends IntrospectionType<any>,
  Fragments extends Record<string, FragmentDefinitionNode>
> = Type extends IntrospectionNonNullTypeRef
  ? UnwrapTypeInner<Type['ofType'], SelectionSet, Introspection, Fragments>
  : Type extends IntrospectionListTypeRef
  ? Array<UnwrapType<Type['ofType'], SelectionSet, Introspection, Fragments>>
  : Type extends IntrospectionNamedTypeRef
  ? Type['name'] extends keyof Introspection['types']
    ? Introspection['types'][Type['name']] extends ObjectLikeType
      ? SelectionSet extends { kind: Kind.SELECTION_SET; selections: any }
        ? Selection<
            SelectionSet['selections'],
            Introspection['types'][Type['name']],
            Introspection,
            Fragments
          >
        : {}
      : Introspection['types'][Type['name']] extends { kind: 'SCALAR' | 'ENUM'; type: infer Type }
      ? Type
      : never
    : never
  : never;

type UnwrapType<
  Type extends IntrospectionTypeRef,
  SelectionSet extends { kind: Kind.SELECTION_SET } | undefined,
  Introspection extends IntrospectionType<any>,
  Fragments extends Record<string, FragmentDefinitionNode>
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
  Selection extends { kind: Kind.FRAGMENT_SPREAD | Kind.INLINE_FRAGMENT },
  Fragments extends Record<string, FragmentDefinitionNode>
> = Selection extends { kind: Kind.INLINE_FRAGMENT; selectionSet: any }
  ? Selection['selectionSet']['selections']
  : Selection extends { kind: Kind.FRAGMENT_SPREAD; name: any }
  ? Selection['name']['value'] extends keyof Fragments
    ? Fragments[Selection['name']['value']]['selectionSet']['selections']
    : readonly []
  : readonly [];

type FragmentType<
  Spread extends { kind: Kind.FRAGMENT_SPREAD | Kind.INLINE_FRAGMENT },
  BaseType extends ObjectLikeType,
  Introspection extends IntrospectionType<any>,
  Fragments extends Record<string, FragmentDefinitionNode>
> = Spread extends { kind: Kind.INLINE_FRAGMENT; typeCondition: any }
  ? Spread['typeCondition'] extends { kind: Kind.NAMED_TYPE }
    ? Spread['typeCondition']['name']['value'] extends keyof Introspection['types']
      ? Introspection['types'][Spread['typeCondition']['name']['value']] extends ObjectLikeType
        ? Introspection['types'][Spread['typeCondition']['name']['value']]
        : never
      : never
    : BaseType
  : Spread extends { kind: Kind.FRAGMENT_SPREAD; name: any }
  ? Spread['name']['value'] extends keyof Fragments
    ? Fragments[Spread['name']['value']]['typeCondition']['name']['value'] extends keyof Introspection['types']
      ? Introspection['types'][Fragments[Spread['name']['value']]['typeCondition']['name']['value']] extends ObjectLikeType
        ? Introspection['types'][Fragments[Spread['name']['value']]['typeCondition']['name']['value']]
        : BaseType
      : never
    : never
  : never;

type TypenameOfType<X extends ObjectLikeType> = X extends {
  kind: 'UNION' | 'INTERFACE';
  possibleTypes: infer PossibleTypes;
}
  ? PossibleTypes
  : X['name'];

// TODO: Do we need to handle `__typename` in `FieldSelectionContinue` to only output remaining possible values,
// i.e. excluding `PossibleFragmentsSelection<...>['__typename']` when we're on a GraphQL union or interface?
// TODO: For the interface case, do we need to type-union `FieldSelectionContinue<...>` into each possible
// intersection type of `PossibleFragmentsSelection<...>`?
export type Selection<
  Selections extends readonly any[],
  Type extends ObjectLikeType,
  Introspection extends IntrospectionType<any>,
  Fragments extends Record<string, FragmentDefinitionNode>
> = Obj<
  FieldSelectionContinue<Selections, Type, Introspection, Fragments> &
    PossibleFragmentsSelection<Selections, Type, Introspection, Fragments>
>;

type FieldSelectionContinue<
  Selections extends readonly unknown[],
  Type extends ObjectLikeType,
  Introspection extends IntrospectionType<any>,
  Fragments extends Record<string, FragmentDefinitionNode>
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
            [Prop in FieldAlias<Selection>]?:
              | (Selection['name']['value'] extends '__typename'
                  ? TypenameOfType<Type>
                  : UnwrapType<
                      Type['fields'][Selection['name']['value']]['type'],
                      Selection['selectionSet'],
                      Introspection,
                      Fragments
                    >)
              | undefined;
          }
      : {}) &
      FieldSelectionContinue<Rest, Type, Introspection, Fragments>
  : {};

type PossibleFragmentsContinue<
  PossibleType extends string,
  Selections extends readonly unknown[],
  Type extends ObjectLikeType,
  Introspection extends IntrospectionType<any>,
  Fragments extends Record<string, FragmentDefinitionNode>
> = Selections extends [infer Selection, ...infer Rest]
  ? PossibleFragmentsContinue<PossibleType, Rest, Type, Introspection, Fragments> extends [
      ...infer Rest
    ]
    ? Selection extends { kind: Kind.FRAGMENT_SPREAD | Kind.INLINE_FRAGMENT }
      ? FragmentType<Selection, Type, Introspection, Fragments>['name'] extends PossibleType
        ? [Selection, ...Rest]
        : FragmentType<Selection, Type, Introspection, Fragments> extends {
            possibleTypes: infer PossibleSubtypes;
          }
        ? PossibleType extends PossibleSubtypes
          ? [Selection, ...Rest]
          : Rest
        : Rest
      : Rest
    : never
  : Selections extends []
  ? []
  : never;

type PossibleFragmentsSelection<
  Selections extends readonly unknown[],
  Type extends ObjectLikeType,
  Introspection extends IntrospectionType<any>,
  Fragments extends Record<string, FragmentDefinitionNode>
> = Type extends { kind: 'UNION' | 'INTERFACE'; possibleTypes: infer PossibleTypes }
  ? PossibleTypes extends string
    ? ObjValues<{
        [SubtypeName in PossibleTypes]: FragmentSelectionContinue<
          PossibleFragmentsContinue<SubtypeName, Selections, Type, Introspection, Fragments>,
          Type,
          Introspection,
          Fragments
        >;
      }>
    : {}
  : Type extends { kind: 'OBJECT' }
  ? FragmentSelectionContinue<Selections, Type, Introspection, Fragments>
  : {};

type FragmentSelectionContinue<
  Selections extends readonly unknown[],
  Type extends ObjectLikeType,
  Introspection extends IntrospectionType<any>,
  Fragments extends Record<string, FragmentDefinitionNode>
> = Selections extends [infer Fragment, ...infer Rest]
  ? (Fragment extends FragmentSpreadNode | InlineFragmentNode
      ? Selection<
          FragmentSelection<Fragment, Fragments>,
          FragmentType<Fragment, Type, Introspection, Fragments>,
          Introspection,
          Fragments
        > extends infer Selection
        ? ShouldInclude<Fragment['directives']> extends true
          ? Selection
          : Selection | {}
        : never
      : {}) &
      FragmentSelectionContinue<Rest, Type, Introspection, Fragments>
  : {};

type DefinitionContinue<
  Definitions extends any[],
  Introspection extends IntrospectionType<any>,
  Fragments extends Record<string, FragmentDefinitionNode>
> = Definitions extends readonly [infer Definition, ...infer Rest]
  ? (Definition extends {
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
      : {}) &
      DefinitionContinue<Rest, Introspection, Fragments>
  : {};

export type TypedDocument<
  Document extends { kind: Kind.DOCUMENT; definitions: any[] },
  Introspection extends IntrospectionType<any>,
  Fragments extends Record<string, FragmentDefinitionNode> = FragmentMap<Document>
> = DefinitionContinue<Document['definitions'], Introspection, Fragments>;

type _FragmentMapContinue<Definitions> = Definitions extends readonly [
  infer Definition,
  ...infer Rest
]
  ? (Definition extends { kind: Kind.FRAGMENT_DEFINITION; name: any }
      ? { [Prop in Definition['name']['value']]: Definitions[0] }
      : {}) &
      _FragmentMapContinue<Rest>
  : {};

export type FragmentMap<Document extends { kind: Kind.DOCUMENT; definitions: any[] }> =
  _FragmentMapContinue<Document['definitions']>;
