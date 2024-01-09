import type {
  Kind,
  FieldNode,
  FragmentSpreadNode,
  InlineFragmentNode,
  NameNode,
} from '@0no-co/graphql.web';

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
  Fragments extends { [name: string]: any }
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
  : never;

type UnwrapType<
  Type extends IntrospectionTypeRef,
  SelectionSet extends { kind: Kind.SELECTION_SET } | undefined,
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any }
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
  Fragments extends { [name: string]: any }
> = Selection extends { kind: Kind.INLINE_FRAGMENT; selectionSet: any }
  ? Selection['selectionSet']['selections']
  : Selection extends { kind: Kind.FRAGMENT_SPREAD; name: any }
  ? Selection['name']['value'] extends keyof Fragments
    ? Fragments[Selection['name']['value']]['selectionSet']['selections']
    : readonly []
  : readonly [];

type FragmentSpreadType<
  Spread extends { kind: Kind.FRAGMENT_SPREAD | Kind.INLINE_FRAGMENT },
  BaseType extends ObjectLikeType,
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any }
> = Spread extends { kind: Kind.INLINE_FRAGMENT; typeCondition?: any }
  ? Spread['typeCondition'] extends { kind: Kind.NAMED_TYPE; name: any }
    ? Introspection['types'][Spread['typeCondition']['name']['value']]
    : BaseType
  : Spread extends { kind: Kind.FRAGMENT_SPREAD; name: any }
  ? Spread['name']['value'] extends keyof Fragments
    ? Introspection['types'][Fragments[Spread['name']['value']]['typeCondition']['name']['value']]
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
  Fragments extends { [name: string]: any }
> = Obj<
  FieldSelectionContinue<Selections, Type, Introspection, Fragments> &
    PossibleFragmentsSelection<Selections, Type, Introspection, Fragments>
>;

type FieldSelectionContinue<
  Selections extends readonly unknown[],
  Type extends ObjectLikeType,
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any }
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
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any }
> = Selections extends [infer Selection, ...infer Rest]
  ? PossibleFragmentsContinue<PossibleType, Rest, Type, Introspection, Fragments> extends [
      ...infer Rest
    ]
    ? Selection extends { kind: Kind.FRAGMENT_SPREAD | Kind.INLINE_FRAGMENT }
      ? FragmentSpreadType<Selection, Type, Introspection, Fragments>['name'] extends PossibleType
        ? [Selection, ...Rest]
        : FragmentSpreadType<Selection, Type, Introspection, Fragments> extends {
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
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any }
> = Type extends { kind: 'UNION' | 'INTERFACE'; possibleTypes: any }
  ? ObjValues<{
      [SubtypeName in Type['possibleTypes']]: FragmentSelectionContinue<
        PossibleFragmentsContinue<SubtypeName, Selections, Type, Introspection, Fragments>,
        Type,
        Introspection,
        Fragments
      >;
    }>
  : Type extends { kind: 'OBJECT' }
  ? FragmentSelectionContinue<Selections, Type, Introspection, Fragments>
  : {};

type FragmentSelectionContinue<
  Selections extends readonly unknown[],
  Type extends ObjectLikeType,
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any }
> = Selections extends [infer Fragment, ...infer Rest]
  ? (Fragment extends FragmentSpreadNode | InlineFragmentNode
      ? Selection<
          FragmentSelection<Fragment, Fragments>,
          FragmentSpreadType<Fragment, Type, Introspection, Fragments>,
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
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any }
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
  Fragments extends { [name: string]: any } = FragmentMap<Document>
> = DefinitionContinue<Document['definitions'], Introspection, Fragments>;

export type FragmentType<
  Document extends { kind: Kind.DOCUMENT; definitions: any[] },
  Introspection extends IntrospectionLikeType,
  Fragments extends { [name: string]: any } = FragmentMap<Document>
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
          Fragments
        >
      : never
    : never
  : never;
