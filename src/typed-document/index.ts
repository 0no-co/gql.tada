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
  Introspection,
  IntrospectionField,
  IntrospectionListTypeRef,
  IntrospectionNamedTypeRef,
  IntrospectionNonNullTypeRef,
  IntrospectionTypeRef,
} from '../introspection';

type ExpandAbstractType<
  Selections extends readonly any[],
  I extends Introspection<any>,
  Fragments extends Record<string, unknown>
> =
  | (Selections[0] extends SelectionNode
      ? Selections[0] extends FragmentSpreadNode
        ? Selections[0]['name']['value'] extends keyof Fragments
          ? Fragments[Selections[0]['name']['value']]
          : never
        : Selections[0] extends InlineFragmentNode
        ? Selections[0]['typeCondition'] extends NamedTypeNode
          ? Selections[0]['typeCondition']['name']['value'] extends keyof I['types']
            ? SelectionContinue<
                Selections[0]['selectionSet']['selections'],
                I['types'][Selections[0]['typeCondition']['name']['value']],
                I,
                Fragments
              >
            : never
          : never
        : never
      : never)
  | (Selections extends readonly []
      ? never
      : Selections extends readonly [any, ...infer Rest]
      ? ExpandAbstractType<Rest, I, Fragments>
      : never);

type UnwrapType<
  Type extends IntrospectionTypeRef,
  SelectionSet extends SelectionSetNode | undefined,
  I extends Introspection<any>,
  Fragments extends Record<string, unknown>
> = Type extends IntrospectionListTypeRef
  ? Array<UnwrapType<Type['ofType'], SelectionSet, I, Fragments>> | null
  : Type extends IntrospectionNonNullTypeRef
  ? NonNullable<UnwrapType<Type['ofType'], SelectionSet, I, Fragments>>
  : Type extends IntrospectionNamedTypeRef
  ? Type['name'] extends keyof I['types']
    ? SelectionSet extends SelectionSetNode
      ? I['types'][Type['name']] extends {
          kind: 'OBJECT';
          name: string;
          fields: { [key: string]: IntrospectionField };
        }
        ? SelectionContinue<
            SelectionSet['selections'],
            I['types'][Type['name']],
            I,
            Fragments
          > | null
        : I['types'][Type['name']] extends {
            kind: 'UNION';
          }
        ? ExpandAbstractType<SelectionSet['selections'], I, Fragments>
        : I['types'][Type['name']] extends {
            kind: 'INTERFACE';
          }
        ? ExpandAbstractType<SelectionSet['selections'], I, Fragments>
        : never
      : I['types'][Type['name']] extends {
          kind: 'SCALAR';
          type: any;
        }
      ? I['types'][Type['name']]['type'] extends string
        ? string | null
        : I['types'][Type['name']]['type'] extends boolean
        ? boolean | null
        : I['types'][Type['name']]['type'] extends number
        ? number | null
        : I['types'][Type['name']]['type'] extends string | number
        ? string | number | null
        : I['types'][Type['name']]['type'] extends bigint
        ? bigint | null
        : never
      : never
    : never
  : never;

type SelectionContinue<
  Selections extends readonly any[],
  Type extends { kind: 'OBJECT'; name: string; fields: { [key: string]: IntrospectionField } },
  I extends Introspection<any>,
  Fragments extends Record<string, unknown>
> = (Selections[0] extends SelectionNode
  ? Selections[0] extends FieldNode
    ? Selections[0]['name']['value'] extends string
      ? {
          [Prop in Selections[0]['name']['value']]: Selections[0]['name']['value'] extends '__typename'
            ? Type['name']
            : UnwrapType<
                Type['fields'][Selections[0]['name']['value']]['type'],
                Selections[0]['selectionSet'],
                I,
                Fragments
              >;
        }
      : {}
    : Selections[0] extends FragmentSpreadNode
    ? Selections[0]['name']['value'] extends keyof Fragments
      ? Fragments[Selections[0]['name']['value']]
      : never
    : Selections[0] extends InlineFragmentNode
    ? Selections[0]['typeCondition'] extends NamedTypeNode
      ? Selections[0]['typeCondition']['name']['value'] extends keyof I['types']
        ? SelectionContinue<
            Selections[0]['selectionSet']['selections'],
            I['types'][Selections[0]['typeCondition']['name']['value']],
            I,
            Fragments
          >
        : never
      : SelectionContinue<Selections[0]['selectionSet']['selections'], Type, I, Fragments>
    : {}
  : {}) &
  (Selections extends readonly []
    ? {}
    : Selections extends readonly [any, ...infer Rest]
    ? SelectionContinue<Rest, Type, I, Fragments>
    : {});

type DefinitionContinue<
  T extends any[],
  I extends Introspection<any>,
  Fragments extends Record<string, unknown>
> = (T[0] extends OperationDefinitionNode
  ? SelectionContinue<
      T[0]['selectionSet']['selections'],
      I['types'][I[T[0]['operation']]],
      I,
      Fragments
    >
  : {}) &
  (T extends readonly []
    ? {}
    : T extends readonly [any, ...infer Rest]
    ? DefinitionContinue<Rest, I, Fragments>
    : {});

export type TypedDocument<
  D extends { kind: Kind.DOCUMENT; definitions: any[] },
  I extends Introspection<any>,
  Fragments extends Record<string, unknown> = FragmentMap<D, I>
> = DefinitionContinue<D['definitions'], I, Fragments>;

type FragmentMapContinue<
  D extends any[],
  I extends Introspection<any>
> = (D[0] extends FragmentDefinitionNode
  ? D[0]['typeCondition']['name']['value'] extends keyof I['types']
    ? D[0]['name']['value'] extends string
      ? {
          [Prop in D[0]['name']['value']]: SelectionContinue<
            D[0]['selectionSet']['selections'],
            I['types'][D[0]['typeCondition']['name']['value']],
            I,
            {}
          >;
        }
      : {}
    : {}
  : {}) &
  (D extends readonly []
    ? {}
    : D extends readonly [any, ...infer Rest]
    ? FragmentMapContinue<Rest, I>
    : {});

type FragmentMap<
  D extends { kind: Kind.DOCUMENT; definitions: any[] },
  I extends Introspection<any>
> = FragmentMapContinue<D['definitions'], I>;
