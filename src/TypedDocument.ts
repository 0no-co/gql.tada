import { Document as ParseDocument } from './parser';
import type {
  FieldNode,
  FragmentDefinitionNode,
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
const query = 'query { todos { text id complete } };';
type doc = ParseDocument<typeof query>;

type UnwrapType<
  Type extends IntrospectionTypeRef,
  SelectionSet extends SelectionSetNode | undefined,
  I extends Introspection<typeof schema>
> = Type extends IntrospectionListTypeRef
  ? Array<UnwrapType<Type['ofType'], SelectionSet, I>>
  : Type extends IntrospectionNonNullTypeRef
  ? UnwrapType<Type['ofType'], SelectionSet, I>
  : Type extends IntrospectionNamedTypeRef
  ? Type['name'] extends keyof I['types']
    ? SelectionSet extends SelectionSetNode
      ? I['types'][Type['name']] extends {
          kind: 'OBJECT';
          fields: { [key: string]: IntrospectionField };
        }
        ? SelectionContinue<SelectionSet['selections'], I['types'][Type['name']], I>
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
  I extends Introspection<typeof schema>
> = (Selections[0] extends SelectionNode
  ? Selections[0] extends FieldNode
    ? Selections[0]['name']['value'] extends string
      ? {
          [Prop in Selections[0]['name']['value']]: UnwrapType<
            Type['fields'][Selections[0]['name']['value']]['type'],
            Selections[0]['selectionSet'],
            I
          >;
        }
      : {}
    : Selections[0] extends InlineFragmentNode
    ? // TODO: how to support fragment-spread
      Selections[0]['typeCondition'] extends NamedTypeNode
      ? Selections[0]['typeCondition']['name']['value'] extends keyof I['types']
        ? SelectionContinue<
            Selections[0]['selectionSet']['selections'],
            I['types'][Selections[0]['typeCondition']['name']['value']],
            I
          >
        : never
      : SelectionContinue<Selections[0]['selectionSet']['selections'], Type, I>
    : {}
  : {}) &
  (Selections extends readonly []
    ? {}
    : Selections extends readonly [any, ...infer Rest]
    ? SelectionContinue<Rest, Type, I>
    : {});

// TODO: this currently only goes over the first node but seeing whether we can now make
// nested selections work
type DefinitionContinue<T extends any[], I extends Introspection<typeof schema>> =
  | (T[0] extends OperationDefinitionNode
      ? SelectionContinue<T[0]['selectionSet']['selections'], I['types'][I[T[0]['operation']]], I>
      : never)
  | (T[0] extends FragmentDefinitionNode ? I[T[0]['typeCondition']['name']['value']] : never);

type TypedDocument<
  D extends ParseDocument<typeof query>,
  I extends Introspection<typeof schema>
> = DefinitionContinue<D['definitions'], I>;

// TODO: go over the operatioon definitions and get all required variables
type Variables<
  _D extends ParseDocument<typeof query>,
  _I extends Introspection<typeof schema>
> = never;

let union: Introspection<typeof schema>['types']['LatestTodoResult']['possibleTypes'][0];
let result: TypedDocument<doc, Intro>;
