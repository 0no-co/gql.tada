import type {
  DirectiveNode,
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  Kind,
  NameNode,
  NamedTypeNode,
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
  Fragments extends Record<string, unknown>
> = Type extends IntrospectionListTypeRef
  ? Array<UnwrapType<Type['ofType'], SelectionSet, Introspection, Fragments>> | null
  : Type extends IntrospectionNonNullTypeRef
  ? NonNullable<UnwrapType<Type['ofType'], SelectionSet, Introspection, Fragments>>
  : Type extends IntrospectionNamedTypeRef
  ? Type['name'] extends keyof Introspection['types']
    ? SelectionSet extends SelectionSetNode
      ? Introspection['types'][Type['name']] extends {
          kind: 'OBJECT';
          name: string;
          fields: { [key: string]: IntrospectionField };
        }
        ? SelectionContinue<
            SelectionSet['selections'],
            Introspection['types'][Type['name']],
            Introspection,
            Fragments
          > | null
        : Introspection['types'][Type['name']] extends {
            kind: 'INTERFACE' | 'UNION';
            name: string;
            fields: { [key: string]: IntrospectionField };
          }
        ?
            | SelectionContinue<
                SelectionSet['selections'],
                Introspection['types'][Type['name']],
                Introspection,
                Fragments
              >
            | {} // TODO: handle interfaces that are always implemented
        : never
      : ScalarValue<Type, Introspection>
    : never
  : never;

type ShouldInclude<Directives extends unknown[] | undefined, Type> = Directives extends readonly [
  infer Directive,
  ...infer Rest
]
  ? Directive extends DirectiveNode
    ? Directive['name']['value'] extends 'include' | 'skip' | 'defer'
      ? Type | undefined
      : ShouldInclude<Rest, Type>
    : ShouldInclude<Rest, Type>
  : Type;

type FieldAlias<Field extends FieldNode> = Field['alias'] extends NameNode
  ? Field['alias']['value']
  : Field['name']['value'];

type FragmentType<
  Spread extends InlineFragmentNode,
  BaseType extends {
    kind: 'OBJECT' | 'INTERFACE' | 'UNION';
    name: string;
    fields: { [key: string]: IntrospectionField };
  },
  Introspection extends IntrospectionType<any>
> = Spread['typeCondition'] extends NamedTypeNode
  ? Spread['typeCondition']['name']['value'] extends keyof Introspection['types']
    ? Introspection['types'][Spread['typeCondition']['name']['value']]
    : never
  : BaseType;

type SelectionContinue<
  Selections extends readonly any[],
  Type extends {
    kind: 'OBJECT' | 'INTERFACE' | 'UNION';
    name: string;
    fields: { [key: string]: IntrospectionField };
  },
  Introspection extends IntrospectionType<any>,
  Fragments extends Record<string, unknown>
> = (Selections[0] extends SelectionNode
  ? Selections[0] extends FieldNode
    ? {
        [Prop in FieldAlias<Selections[0]>]: Selections[0]['name']['value'] extends '__typename'
          ? ShouldInclude<Selections[0]['directives'], Type['name']>
          : ShouldInclude<
              Selections[0]['directives'],
              UnwrapType<
                Type['fields'][Selections[0]['name']['value']]['type'],
                Selections[0]['selectionSet'],
                Introspection,
                Fragments
              >
            >;
      }
    : Selections[0] extends FragmentSpreadNode
    ? Selections[0]['name']['value'] extends keyof Fragments // TODO: handle nullable fields coming from @defer here
      ? Fragments[Selections[0]['name']['value']]
      : never
    : Selections[0] extends InlineFragmentNode
    ? SelectionContinue<
        Selections[0]['selectionSet']['selections'],
        FragmentType<Selections[0], Type, Introspection>,
        Introspection,
        Fragments
      >
    : {}
  : {}) &
  (Selections extends readonly []
    ? {}
    : Selections extends readonly [any, ...infer Rest]
    ? SelectionContinue<Rest, Type, Introspection, Fragments>
    : never);

type DefinitionContinue<
  Definitions extends any[],
  Introspection extends IntrospectionType<any>,
  Fragments extends Record<string, unknown>
> = (Definitions[0] extends { kind: 'OperationDefinition' }
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
  Fragments extends Record<string, unknown> = FragmentMap<Document, Introspection>
> = DefinitionContinue<Document['definitions'], Introspection, Fragments>;

type FragmentMapContinue<
  Definitions extends any[],
  Introspection extends IntrospectionType<any>
> = (Definitions[0] extends FragmentDefinitionNode
  ? Definitions[0]['typeCondition']['name']['value'] extends keyof Introspection['types']
    ? Definitions[0]['name']['value'] extends string
      ? {
          [Prop in Definitions[0]['name']['value']]: SelectionContinue<
            Definitions[0]['selectionSet']['selections'],
            Introspection['types'][Definitions[0]['typeCondition']['name']['value']],
            Introspection,
            {}
          >;
        }
      : {}
    : {}
  : {}) &
  (Definitions extends readonly [any, ...infer Rest]
    ? Rest extends readonly []
      ? {}
      : FragmentMapContinue<Rest, Introspection>
    : never);

export type FragmentMap<
  Document extends { kind: Kind.DOCUMENT; definitions: any[] },
  Introspection extends IntrospectionType<any>
> = FragmentMapContinue<Document['definitions'], Introspection>;
