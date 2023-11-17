import type {
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  Kind,
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
import { DirectiveNode } from '@0no-co/graphql.web';

type ScalarValue<
  Type extends IntrospectionNamedTypeRef,
  Introspection extends IntrospectionType<any>
> = Type['name'] extends keyof Introspection['types']
  ? Introspection['types'][Type['name']] extends {
      kind: 'SCALAR';
      type: infer Type;
    }
    ? Type extends string
      ? string | null
      : Type extends boolean
      ? boolean | null
      : Type extends number
      ? number | null
      : Type extends string | number
      ? string | number | null
      : Type extends bigint
      ? bigint | null
      : never
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
            kind: 'UNION';
            name: string;
            fields: { [key: string]: IntrospectionField };
          }
        ? SelectionContinue<
            SelectionSet['selections'],
            Introspection['types'][Type['name']],
            Introspection,
            Fragments
          >
        : Introspection['types'][Type['name']] extends {
            kind: 'INTERFACE';
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
      : Type extends { kind: 'ENUM' }
      ? Type['name'] extends keyof Introspection['types']
        ? Introspection['types'][Type['name']] extends {
            kind: 'ENUM';
            type: infer Type;
          }
          ? Type
          : never
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
    ? Selections[0]['alias']['value'] extends string
      ? {
          [Prop in Selections[0]['alias']['value']]: Selections[0]['name']['value'] extends '__typename'
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
      : {
          [Prop in Selections[0]['name']['value']]: Selections[0]['name']['value'] extends '__typename'
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
    ? Selections[0]['name']['value'] extends keyof Fragments
      ? Fragments[Selections[0]['name']['value']]
      : never
    : Selections[0] extends InlineFragmentNode
    ? Selections[0]['typeCondition'] extends NamedTypeNode
      ? Selections[0]['typeCondition']['name']['value'] extends keyof Introspection['types']
        ? SelectionContinue<
            Selections[0]['selectionSet']['selections'],
            Introspection['types'][Selections[0]['typeCondition']['name']['value']],
            Introspection,
            Fragments
          >
        : never
      : SelectionContinue<
          Selections[0]['selectionSet']['selections'],
          Type,
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
