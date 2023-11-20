import type {
  DirectiveNode,
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  Kind,
  NameNode,
  NamedTypeNode,
  OperationDefinitionNode,
  SelectionNode,
  SelectionSetNode,
} from '@0no-co/graphql.web';
import type {
  Introspection as IntrospectionType,
  IntrospectionField,
  IntrospectionListTypeRef,
  IntrospectionNamedTypeRef,
  IntrospectionNonNullTypeRef,
  IntrospectionTypeRef,
} from '../introspection';
import type { Obj, ObjValues } from '../utils';

type ObjectLikeType = {
  kind: 'OBJECT' | 'INTERFACE' | 'UNION';
  name: string;
  fields: { [key: string]: IntrospectionField };
};

type UnwrapTypeInner<
  Type extends IntrospectionTypeRef,
  SelectionSet extends SelectionSetNode | undefined,
  Introspection extends IntrospectionType<any>,
  Fragments extends Record<string, FragmentDefinitionNode>
> = 
  Type extends IntrospectionNonNullTypeRef
    ? UnwrapTypeInner<Type['ofType'], SelectionSet, Introspection, Fragments>
    : Type extends IntrospectionListTypeRef
    ? Array<UnwrapType<Type['ofType'], SelectionSet, Introspection, Fragments>>
    : Type extends IntrospectionNamedTypeRef
    ? Type['name'] extends keyof Introspection['types']
      ? Introspection['types'][Type['name']] extends ObjectLikeType
        ? SelectionSet extends SelectionSetNode
          ? Selection<
              SelectionSet['selections'],
              Introspection['types'][Type['name']],
              Introspection,
              Fragments
            >
          : {}
        : Introspection['types'][Type['name']] extends { kind: 'SCALAR' | 'ENUM', type: infer Type }
        ? Type
        : never
      : never
    : never;

type UnwrapType<
  Type extends IntrospectionTypeRef,
  SelectionSet extends SelectionSetNode | undefined,
  Introspection extends IntrospectionType<any>,
  Fragments extends Record<string, FragmentDefinitionNode>
> =
  Type extends IntrospectionNonNullTypeRef
    ? UnwrapTypeInner<Type['ofType'], SelectionSet, Introspection, Fragments>
    : null | UnwrapTypeInner<Type, SelectionSet, Introspection, Fragments>;

type ShouldInclude<Directives extends unknown[] | undefined> = Directives extends readonly [
  infer Directive,
  ...infer Rest
]
  ? Directive extends DirectiveNode
    ? Directive['name']['value'] extends 'include' | 'skip' | 'defer'
      ? false
      : ShouldInclude<Rest>
    : ShouldInclude<Rest>
  : true;

type FieldAlias<Field extends FieldNode> = Field['alias'] extends NameNode
  ? Field['alias']['value']
  : Field['name']['value'];

type FragmentSelection<
  Selection extends FragmentSpreadNode | InlineFragmentNode,
  Fragments extends Record<string, FragmentDefinitionNode>
> = Selection extends { kind: Kind.INLINE_FRAGMENT }
  ? Selection['selectionSet']['selections']
  : Selection extends { kind: Kind.FRAGMENT_SPREAD }
  ? Selection['name']['value'] extends keyof Fragments
    ? Fragments[Selection['name']['value']]['selectionSet']['selections']
    : readonly []
  : readonly [];

type FragmentType<
  Spread extends InlineFragmentNode | FragmentSpreadNode,
  BaseType extends ObjectLikeType,
  Introspection extends IntrospectionType<any>,
  Fragments extends Record<string, FragmentDefinitionNode>
> = Spread extends InlineFragmentNode
  ? Spread['typeCondition'] extends NamedTypeNode
    ? Spread['typeCondition']['name']['value'] extends keyof Introspection['types']
      ? Introspection['types'][Spread['typeCondition']['name']['value']]
      : never
    : BaseType
  : Spread extends FragmentSpreadNode
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
type Selection<
  Selections extends readonly any[],
  Type extends ObjectLikeType,
  Introspection extends IntrospectionType<any>,
  Fragments extends Record<string, FragmentDefinitionNode>
> = Obj<
  FieldSelectionContinue<Selections, Type, Introspection, Fragments>
    & PossibleFragmentsSelection<Selections, Type, Introspection, Fragments>
>;

type FieldSelectionContinue<
  Selections extends readonly any[],
  Type extends ObjectLikeType,
  Introspection extends IntrospectionType<any>,
  Fragments extends Record<string, FragmentDefinitionNode>
> = Obj<
  (Selections[0] extends SelectionNode
    ? Selections[0] extends FieldNode
      ? ShouldInclude<Selections[0]['directives']> extends true
        ? {
            [Prop in FieldAlias<Selections[0]>]: Selections[0]['name']['value'] extends '__typename'
              ? TypenameOfType<Type>
              : UnwrapType<
                  Type['fields'][Selections[0]['name']['value']]['type'],
                  Selections[0]['selectionSet'],
                  Introspection,
                  Fragments
                >;
          }
        : {
            [Prop in FieldAlias<Selections[0]>]?:
              | (Selections[0]['name']['value'] extends '__typename'
                  ? TypenameOfType<Type>
                  : UnwrapType<
                      Type['fields'][Selections[0]['name']['value']]['type'],
                      Selections[0]['selectionSet'],
                      Introspection,
                      Fragments
                    >)
              | undefined;
          }
      : {}
    : {}) &
    (Selections extends readonly []
      ? {}
      : Selections extends readonly [any, ...infer Rest]
      ? FieldSelectionContinue<Rest, Type, Introspection, Fragments>
      : {})
>;

type PossibleFragmentsContinue<
  PossibleType extends string,
  Selections extends readonly any[],
  Type extends ObjectLikeType,
  Introspection extends IntrospectionType<any>,
  Fragments extends Record<string, FragmentDefinitionNode>
> =
  Selections extends [infer Selection, ...infer Rest]
    ? PossibleFragmentsContinue<PossibleType, Rest, Type, Introspection, Fragments> extends [...infer Rest]
      ? (Selection extends FragmentSpreadNode | InlineFragmentNode
        ? FragmentType<Selection, Type, Introspection, Fragments>['name'] extends PossibleType
        ? [Selection, ...Rest]
        : FragmentType<Selection, Type, Introspection, Fragments> extends { possibleTypes: infer PossibleSubtypes }
          ? PossibleType extends PossibleSubtypes
            ? [Selection, ...Rest]
            : Rest
        : Rest
        : Rest)
      : never
    : Selections extends []
    ? []
    : never;

type PossibleFragmentsSelection<
  Selections extends readonly any[],
  Type extends ObjectLikeType,
  Introspection extends IntrospectionType<any>,
  Fragments extends Record<string, FragmentDefinitionNode>
> = (
  Type extends { kind: 'UNION' | 'INTERFACE', possibleTypes: infer PossibleTypes }
    ? PossibleTypes extends string
    ? ObjValues<{
        [SubtypeName in PossibleTypes]: FragmentSelectionContinue<
          PossibleFragmentsContinue<SubtypeName, Selections, Type, Introspection, Fragments>,
          Type,
          Introspection,
          Fragments
        >
      }>
    : {}
  : Type extends { kind: 'OBJECT' }
    ? FragmentSelectionContinue<
        Selections,
        Type,
        Introspection,
        Fragments
      >
  : {}
);

type FragmentSelectionContinue<
  Selections extends readonly any[],
  Type extends ObjectLikeType,
  Introspection extends IntrospectionType<any>,
  Fragments extends Record<string, FragmentDefinitionNode>
> = Obj<
  (Selections[0] extends FragmentSpreadNode | InlineFragmentNode
    ? Selection<
        FragmentSelection<Selections[0], Fragments>,
        FragmentType<Selections[0], Type, Introspection, Fragments>,
        Introspection,
        Fragments
      > extends infer Selection
      ? ShouldInclude<Selections[0]['directives']> extends true
        ? Selection
        : Selection | {}
      : never
    : {}) &
  (Selections extends readonly []
    ? {}
    : Selections extends readonly [any, ...infer Rest]
    ? FragmentSelectionContinue<Rest, Type, Introspection, Fragments>
    : {})
>;

type DefinitionContinue<
  Definitions extends any[],
  Introspection extends IntrospectionType<any>,
  Fragments extends Record<string, FragmentDefinitionNode>
> = (Definitions[0] extends OperationDefinitionNode
  ? Selection<
      Definitions[0]['selectionSet']['selections'],
      Introspection['types'][Introspection[Definitions[0]['operation']]],
      Introspection,
      Fragments
    >
  : {}) &
  (Definitions extends readonly []
    ? {}
    : Definitions extends readonly [any, ...infer Rest]
    ? DefinitionContinue<Rest, Introspection, Fragments>
    : {});

export type TypedDocument<
  Document extends { kind: Kind.DOCUMENT; definitions: any[] },
  Introspection extends IntrospectionType<any>,
  Fragments extends Record<string, FragmentDefinitionNode> = FragmentMap<Document>
> = DefinitionContinue<Document['definitions'], Introspection, Fragments>;

type _FragmentMapContinue<Definitions> = Definitions extends readonly [
  infer Definition,
  ...infer Rest
]
  ? (Definition extends FragmentDefinitionNode
      ? { [Prop in Definition['name']['value']]: Definitions[0] }
      : {}) &
      _FragmentMapContinue<Rest>
  : {};

export type FragmentMap<Document extends { kind: Kind.DOCUMENT; definitions: any[] }> =
  _FragmentMapContinue<Document['definitions']>;
