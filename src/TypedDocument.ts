import { Document as ParseDocument } from './parser';
import type {
  FieldNode,
  FragmentDefinitionNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  NamedTypeNode,
  OperationDefinitionNode,
  SelectionNode,
  SelectionSetNode,
} from '@0no-co/graphql.web';
import {
  Introspection,
  IntrospectionField,
  IntrospectionListTypeRef,
  IntrospectionNamedTypeRef,
  IntrospectionNonNullTypeRef,
  IntrospectionTypeRef,
} from './introspection';
import { schema } from './__tests__/introspection.test-d';

type Intro = Introspection<typeof schema>;
const query = `
  query { todos { ...TodoFields } }
  
  fragment TodoFields on Todo {
    text
    id
    complete
  }
`;
type doc = ParseDocument<typeof query>;

type UnwrapType<
  Type extends IntrospectionTypeRef,
  SelectionSet extends SelectionSetNode | undefined,
  I extends Introspection<typeof schema>,
  Fragments extends Record<string, unknown>
> = Type extends IntrospectionListTypeRef
  ? Array<UnwrapType<Type['ofType'], SelectionSet, I, Fragments>>
  : Type extends IntrospectionNonNullTypeRef
  ? UnwrapType<Type['ofType'], SelectionSet, I, Fragments>
  : Type extends IntrospectionNamedTypeRef
  ? Type['name'] extends keyof I['types']
    ? SelectionSet extends SelectionSetNode
      ? I['types'][Type['name']] extends {
          kind: 'OBJECT';
          fields: { [key: string]: IntrospectionField };
        }
        ? SelectionContinue<SelectionSet['selections'], I['types'][Type['name']], I, Fragments>
        : I['types'][Type['name']] extends {
            kind: 'UNION';
          }
        ? never // TODO
        : I['types'][Type['name']] extends {
            kind: 'INTERFACE';
            possibleTypes: readonly string[];
          }
        ? never // TODO
        : never
      : I['types'][Type['name']] extends {
          kind: 'SCALAR';
          type: any;
        }
      ? I['types'][Type['name']]['type']
      : never
    : never
  : never;

type SelectionContinue<
  Selections extends readonly any[],
  Type extends { kind: 'OBJECT'; fields: { [key: string]: IntrospectionField } },
  I extends Introspection<typeof schema>,
  Fragments extends Record<string, unknown>
> = (Selections[0] extends SelectionNode
  ? Selections[0] extends FieldNode
    ? Selections[0]['name']['value'] extends string
      ? {
          [Prop in Selections[0]['name']['value']]: UnwrapType<
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

// TODO: this currently only goes over the first node but seeing whether we can now make
// nested selections work
type DefinitionContinue<
  T extends any[],
  I extends Introspection<typeof schema>,
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

type TypedDocument<
  D extends ParseDocument<typeof query>,
  I extends Introspection<typeof schema>,
  Fragments extends Record<string, unknown> = FragmentMap<D, I>
> = DefinitionContinue<D['definitions'], I, Fragments>;

// TODO: go over the operatioon definitions and get all required variables
type Variables<
  _D extends ParseDocument<typeof query>,
  _I extends Introspection<typeof schema>
> = never;

type FragmentMapContinue<
  D extends any[],
  I extends Introspection<typeof schema>
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
  D extends ParseDocument<typeof query>,
  I extends Introspection<typeof schema>
> = FragmentMapContinue<D['definitions'], I>;

let unionExample: Introspection<typeof schema>['types']['LatestTodoResult']['possibleTypes'][0];
let interfaceExample: Introspection<typeof schema>['types']['ITodo'];

let x: doc['definitions'][1];
const result: TypedDocument<doc, Intro> = {} as TypedDocument<doc, Intro>;
result.todos[0].complete;
