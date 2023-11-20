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
import type { Obj } from '../utils';

type ObjectLikeType = {
  kind: 'OBJECT' | 'INTERFACE' | 'UNION';
  name: string;
  fields: { [key: string]: IntrospectionField };
};

// TODO: figure out when we need to call `Obj<>`
type ScalarValue<
  Type extends IntrospectionNamedTypeRef,
  Introspection extends IntrospectionType<any>
> = Type['name'] extends keyof Introspection['types']
  ? Introspection['types'][Type['name']] extends {
      kind: 'SCALAR' | 'ENUM';
      type: infer Type;
    }
    ? Type | null
    : never
  : never;

type UnwrapType<
  Type extends IntrospectionTypeRef,
  SelectionSet extends SelectionSetNode | undefined,
  Introspection extends IntrospectionType<any>,
  Fragments extends Record<string, FragmentDefinitionNode>
> = Type extends IntrospectionListTypeRef
  ? Array<UnwrapType<Type['ofType'], SelectionSet, Introspection, Fragments>> | null
  : Type extends IntrospectionNonNullTypeRef
  ? NonNullable<UnwrapType<Type['ofType'], SelectionSet, Introspection, Fragments>>
  : Type extends IntrospectionNamedTypeRef
  ? Type['name'] extends keyof Introspection['types']
    ? SelectionSet extends SelectionSetNode
      ? Introspection['types'][Type['name']] extends ObjectLikeType
          ? SelectionContinue<
            SelectionSet['selections'],
            Introspection['types'][Type['name']],
            Introspection,
            Fragments
          > | null
          : never
      : ScalarValue<Type, Introspection>
    : never
  : never;

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
> =
  Selection extends { kind: Kind.INLINE_FRAGMENT }
    ? Selection['selectionSet']['selections']
    : Selection extends { kind: Kind.FRAGMENT_SPREAD }
    ? Selection['name']['value'] extends keyof Fragments
    ? Fragments[Selection['name']['value']]['selectionSet']['selections']
    : readonly []
    : readonly [];

type FragmentType<
  Spread extends InlineFragmentNode,
  BaseType extends ObjectLikeType,
  Introspection extends IntrospectionType<any>
> = Spread['typeCondition'] extends NamedTypeNode
  ? Spread['typeCondition']['name']['value'] extends keyof Introspection['types']
    ? Introspection['types'][Spread['typeCondition']['name']['value']]
    : never
  : BaseType;

type SelectionContinue<
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
            ? Type['name']
            : UnwrapType<
                Type['fields'][Selections[0]['name']['value']]['type'],
                Selections[0]['selectionSet'],
                Introspection,
                Fragments
              >;
        }
        : {
          [Prop in FieldAlias<Selections[0]>]?: (Selections[0]['name']['value'] extends '__typename'
            ? Type['name']
            : UnwrapType<
                Type['fields'][Selections[0]['name']['value']]['type'],
                Selections[0]['selectionSet'],
                Introspection,
                Fragments
              >) | undefined;
        }
      : SelectionContinue<
          FragmentSelection<Selections[0], Fragments>,
          FragmentType<Selections[0], Type, Introspection>,
          Introspection,
          Fragments
        >/* extends infer Selection
          ? ShouldInclude<Selections[0]['directives']> extends true
          ? Type extends { possibleTypes: infer PossibleTypes }
          ? FragmentType<Selections[0], Type, Introspection>['name'] extends PossibleTypes
          ? Selection | {}
          : Selection
          : Selection
          : Selection | {}
        : never*/
    : {}) &
    (Selections extends readonly []
      ? {}
      : Selections extends readonly [any, ...infer Rest]
      ? SelectionContinue<Rest, Type, Introspection, Fragments>
      : {})
>;

type DefinitionContinue<
  Definitions extends any[],
  Introspection extends IntrospectionType<any>,
  Fragments extends Record<string, FragmentDefinitionNode>
> = (Definitions[0] extends OperationDefinitionNode
  ? SelectionContinue<
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
    : never);

export type TypedDocument<
  Document extends { kind: Kind.DOCUMENT; definitions: any[] },
  Introspection extends IntrospectionType<any>,
  Fragments extends Record<string, FragmentDefinitionNode> = FragmentMap<Document>
> = DefinitionContinue<Document['definitions'], Introspection, Fragments>;

type _FragmentMapContinue<Definitions> =
  Definitions extends readonly [infer Definition, ...infer Rest]
    ? (Definition extends FragmentDefinitionNode
      ? { [Prop in Definition['name']['value']]: Definitions[0] }
      : {}) & _FragmentMapContinue<Rest>
    : {};

export type FragmentMap<
  Document extends { kind: Kind.DOCUMENT; definitions: any[] }
> = _FragmentMapContinue<Document['definitions']>;
