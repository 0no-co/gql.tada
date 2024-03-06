import type { Kind, OperationTypeNode } from '@0no-co/graphql.web';
import type { Token, tokenize } from './tokenizer';

export interface _match<Out, In extends any[]> {
  out: Out;
  in: In;
}

interface _match2<OutA, OutB, In extends any[]> {
  outA: OutA;
  outB: OutB;
  in: In;
}

type takeName<In extends any[]> = In extends [{ kind: Token.Name; name: infer Name }, ...infer In]
  ? _match<{ kind: Kind.NAME; value: Name }, In>
  : void;

type takeOptionalName<In extends any[]> = In extends [
  { kind: Token.Name; name: infer Name },
  ...infer In,
]
  ? _match<{ kind: Kind.NAME; value: Name }, In>
  : _match<undefined, In>;

// prettier-ignore
export type takeValue<In extends any[], Const extends boolean> =
  In extends [Token.Float, ...infer In] ? _match<{ kind: Kind.FLOAT; value: string }, In>
  : In extends [Token.Integer, ...infer In] ? _match<{ kind: Kind.INT; value: string }, In>
  : In extends [Token.String, ...infer In] ? _match<{ kind: Kind.STRING; value: string, block: false }, In>
  : In extends [Token.BlockString, ...infer In] ? _match<{ kind: Kind.STRING; value: string, block: true }, In>
  : In extends [{ kind: Token.Name, name: 'null' }, ...infer In] ? _match<{ kind: Kind.NULL }, In>
  : In extends [{ kind: Token.Name, name: 'true' | 'false' }, ...infer In] ? _match<{ kind: Kind.BOOLEAN; value: boolean }, In>
  : In extends [{ kind: Token.Name, name: infer Name }, ...infer In] ? _match<{ kind: Kind.ENUM; value: Name }, In>
  : In extends [Token.BracketOpen, ...infer In] ? takeListRec<[], In, Const>
  : In extends [Token.BraceOpen, ...infer In] ? takeObjectRec<[], In, Const>
  : Const extends false
    ? In extends [{ kind: Token.Var, name: infer Name }, ...infer In]
      ? _match<{ kind: Kind.VARIABLE; name: { kind: Kind.NAME; value: Name } }, In>
      : void
    : void;

type takeListRec<Nodes extends any[], In extends any[], Const extends boolean> = In extends [
  Token.BracketClose,
  ...infer In,
]
  ? _match<{ kind: Kind.LIST; values: Nodes }, In>
  : takeValue<In, Const> extends _match<infer Node, infer In>
    ? takeListRec<[...Nodes, Node], In, Const>
    : void;

type takeObjectField<In extends any[], Const extends boolean> = In extends [
  { kind: Token.Name; name: infer FieldName },
  Token.Colon,
  ...infer In,
]
  ? takeValue<In, Const> extends _match<infer Value, infer In>
    ? _match<
        { kind: Kind.OBJECT_FIELD; name: { kind: Kind.NAME; value: FieldName }; value: Value },
        In
      >
    : void
  : void;

export type takeObjectRec<
  Fields extends any[],
  In extends any[],
  Const extends boolean,
> = In extends [Token.BraceClose, ...infer In]
  ? _match<{ kind: Kind.OBJECT; fields: Fields }, In>
  : takeObjectField<In, Const> extends _match<infer Field, infer In>
    ? takeObjectRec<[...Fields, Field], In, Const>
    : void;

type takeArgument<In extends any[], Const extends boolean> = takeName<In> extends _match<
  infer Name,
  infer In
>
  ? In extends [Token.Colon, ...infer In]
    ? takeValue<In, Const> extends _match<infer Value, infer In>
      ? _match<{ kind: Kind.ARGUMENT; name: Name; value: Value }, In>
      : void
    : void
  : void;

type _takeArgumentsRec<
  Arguments extends any[],
  In extends any[],
  Const extends boolean,
> = In extends [Token.ParenClose, ...infer In]
  ? _match<Arguments, In>
  : takeArgument<In, Const> extends _match<infer Argument, infer In>
    ? _takeArgumentsRec<[...Arguments, Argument], In, Const>
    : void;
export type takeArguments<In extends any[], Const extends boolean> = In extends [
  Token.ParenOpen,
  ...infer In,
]
  ? _takeArgumentsRec<[], In, Const>
  : _match<[], In>;

export type takeDirective<In extends any[], Const extends boolean> = In extends [
  { kind: Token.Directive; name: infer DirectiveName },
  ...infer In,
]
  ? takeArguments<In, Const> extends _match<infer Arguments, infer In>
    ? _match<
        {
          kind: Kind.DIRECTIVE;
          name: { kind: Kind.NAME; value: DirectiveName };
          arguments: Arguments;
        },
        In
      >
    : void
  : void;

export type takeDirectives<
  In extends any[],
  Const extends boolean,
  Directives extends any[] = [],
> = takeDirective<In, Const> extends _match<infer Directive, infer In>
  ? takeDirectives<In, Const, [...Directives, Directive]>
  : _match<Directives, In>;

type takeFieldName<In extends any[]> = takeName<In> extends _match<infer MaybeAlias, infer In>
  ? In extends [Token.Colon, ...infer In]
    ? takeName<In> extends _match<infer Name, infer In>
      ? _match2<MaybeAlias, Name, In>
      : void
    : _match2<undefined, MaybeAlias, In>
  : void;

export type takeField<In extends any[]> = takeFieldName<In> extends _match2<
  infer Alias,
  infer Name,
  infer In
>
  ? takeArguments<In, false> extends _match<infer Arguments, infer In>
    ? takeDirectives<In, false> extends _match<infer Directives, infer In>
      ? takeSelectionSet<In> extends _match<infer SelectionSet, infer In>
        ? _match<
            {
              kind: Kind.FIELD;
              alias: Alias;
              name: Name;
              arguments: Arguments;
              directives: Directives;
              selectionSet: SelectionSet;
            },
            In
          >
        : _match<
            {
              kind: Kind.FIELD;
              alias: Alias;
              name: Name;
              arguments: Arguments;
              directives: Directives;
              selectionSet: undefined;
            },
            In
          >
      : void
    : void
  : void;

export type takeType<In extends any[]> = In extends [Token.BracketOpen, ...infer In]
  ? takeType<In> extends _match<infer Subtype, infer In>
    ? In extends [Token.BracketClose, ...infer In]
      ? In extends [Token.Exclam, ...infer In]
        ? _match<{ kind: Kind.NON_NULL_TYPE; type: { kind: Kind.LIST_TYPE; type: Subtype } }, In>
        : _match<{ kind: Kind.LIST_TYPE; type: Subtype }, In>
      : void
    : void
  : takeName<In> extends _match<infer Name, infer In>
    ? In extends [Token.Exclam, ...infer In]
      ? _match<{ kind: Kind.NON_NULL_TYPE; type: { kind: Kind.NAMED_TYPE; name: Name } }, In>
      : _match<{ kind: Kind.NAMED_TYPE; name: Name }, In>
    : void;

type takeTypeCondition<In extends any[]> = In extends [
  { kind: Token.Name; name: 'on' },
  ...infer In,
]
  ? takeName<In> extends _match<infer Name, infer In>
    ? _match<{ kind: Kind.NAMED_TYPE; name: Name }, In>
    : void
  : void;

export type takeFragmentSpread<In extends any[]> = In extends [Token.Spread, ...infer In]
  ? In extends [{ kind: Token.Name; name: 'on' }, ...infer In]
    ? takeName<In> extends _match<infer Name, infer In>
      ? takeDirectives<In, false> extends _match<infer Directives, infer In>
        ? takeSelectionSet<In> extends _match<infer SelectionSet, infer In>
          ? _match<
              {
                kind: Kind.INLINE_FRAGMENT;
                typeCondition: { kind: Kind.NAMED_TYPE; name: Name };
                directives: Directives;
                selectionSet: SelectionSet;
              },
              In
            >
          : void
        : void
      : void
    : takeName<In> extends _match<infer Name, infer In>
      ? takeDirectives<In, false> extends _match<infer Directives, infer In>
        ? _match<{ kind: Kind.FRAGMENT_SPREAD; name: Name; directives: Directives }, In>
        : void
      : takeDirectives<In, false> extends _match<infer Directives, infer In>
        ? takeSelectionSet<In> extends _match<infer SelectionSet, infer In>
          ? _match<
              {
                kind: Kind.INLINE_FRAGMENT;
                typeCondition: undefined;
                directives: Directives;
                selectionSet: SelectionSet;
              },
              In
            >
          : void
        : void
  : void;

type _takeSelectionRec<Selections extends any[], In extends any[]> = In extends [
  Token.BraceClose,
  ...infer In,
]
  ? _match<{ kind: Kind.SELECTION_SET; selections: Selections }, In>
  : takeFragmentSpread<In> extends _match<infer Selection, infer In>
    ? _takeSelectionRec<[...Selections, Selection], In>
    : takeField<In> extends _match<infer Selection, infer In>
      ? _takeSelectionRec<[...Selections, Selection], In>
      : void;

export type takeSelectionSet<In extends any[]> = In extends [Token.BraceOpen, ...infer In]
  ? _takeSelectionRec<[], In>
  : void;

export type takeVarDefinition<In extends any[]> = In extends [
  { kind: Token.Var; name: infer VarName },
  Token.Colon,
  ...infer In,
]
  ? takeType<In> extends _match<infer Type, infer In>
    ? In extends [Token.Equal, ...infer In]
      ? takeValue<In, true> extends _match<infer DefaultValue, infer In>
        ? takeDirectives<In, true> extends _match<infer Directives, infer In>
          ? _match<
              {
                kind: Kind.VARIABLE_DEFINITION;
                variable: { kind: Kind.VARIABLE; name: { kind: Kind.NAME; value: VarName } };
                type: Type;
                defaultValue: DefaultValue;
                directives: Directives;
              },
              In
            >
          : void
        : void
      : takeDirectives<In, true> extends _match<infer Directives, infer In>
        ? _match<
            {
              kind: Kind.VARIABLE_DEFINITION;
              variable: { kind: Kind.VARIABLE; name: { kind: Kind.NAME; value: VarName } };
              type: Type;
              defaultValue: undefined;
              directives: Directives;
            },
            In
          >
        : void
    : void
  : void;

type _takeVarDefinitionRec<Definitions extends any[], In extends any[]> = In extends [
  Token.ParenClose,
  ...infer In,
]
  ? _match<Definitions, In>
  : takeVarDefinition<In> extends _match<infer Definition, infer In>
    ? _takeVarDefinitionRec<[...Definitions, Definition], In>
    : void;
export type takeVarDefinitions<In extends any[]> = In extends [Token.ParenOpen, ...infer In]
  ? _takeVarDefinitionRec<[], In>
  : _match<[], In>;

export type takeFragmentDefinition<In extends any[]> = In extends [
  { kind: Token.Name; name: 'fragment' },
  ...infer In,
]
  ? takeName<In> extends _match<infer Name, infer In>
    ? takeTypeCondition<In> extends _match<infer TypeCondition, infer In>
      ? takeDirectives<In, true> extends _match<infer Directives, infer In>
        ? takeSelectionSet<In> extends _match<infer SelectionSet, infer In>
          ? _match<
              {
                kind: Kind.FRAGMENT_DEFINITION;
                name: Name;
                typeCondition: TypeCondition;
                directives: Directives;
                selectionSet: SelectionSet;
              },
              In
            >
          : void
        : void
      : void
    : void
  : void;

type takeOperation<In extends any[]> = In extends [{ kind: Token.Name; name: 'query' }, ...infer In]
  ? _match<OperationTypeNode.QUERY, In>
  : In extends [{ kind: Token.Name; name: 'mutation' }, ...infer In]
    ? _match<OperationTypeNode.MUTATION, In>
    : In extends [{ kind: Token.Name; name: 'subscription' }, ...infer In]
      ? _match<OperationTypeNode.SUBSCRIPTION, In>
      : void;

export type takeOperationDefinition<In extends any[]> = takeOperation<In> extends _match<
  infer Operation,
  infer In
>
  ? takeOptionalName<In> extends _match<infer Name, infer In>
    ? takeVarDefinitions<In> extends _match<infer VarDefinitions, infer In>
      ? takeDirectives<In, false> extends _match<infer Directives, infer In>
        ? takeSelectionSet<In> extends _match<infer SelectionSet, infer In>
          ? _match<
              {
                kind: Kind.OPERATION_DEFINITION;
                operation: Operation;
                name: Name;
                variableDefinitions: VarDefinitions;
                directives: Directives;
                selectionSet: SelectionSet;
              },
              In
            >
          : void
        : void
      : void
    : void
  : takeSelectionSet<In> extends _match<infer SelectionSet, infer In>
    ? _match<
        {
          kind: Kind.OPERATION_DEFINITION;
          operation: OperationTypeNode.QUERY;
          name: undefined;
          variableDefinitions: [];
          directives: [];
          selectionSet: SelectionSet;
        },
        In
      >
    : void;

type _takeDocumentRec<
  Definitions extends any[],
  In extends any[],
> = takeFragmentDefinition<In> extends _match<infer Definition, infer In>
  ? _takeDocumentRec<[...Definitions, Definition], In>
  : takeOperationDefinition<In> extends _match<infer Definition, infer In>
    ? _takeDocumentRec<[...Definitions, Definition], In>
    : _match<Definitions, In>;

type parseDocument<In extends string> = _takeDocumentRec<[], tokenize<In>> extends _match<
  [...infer Definitions],
  any
>
  ? Definitions extends []
    ? never
    : { kind: Kind.DOCUMENT; definitions: Definitions }
  : never;

type parseValue<In extends string> = takeValue<tokenize<In>, false> extends _match<infer Node, any>
  ? Node
  : void;

type parseConstValue<In extends string> = takeValue<tokenize<In>, true> extends _match<
  infer Node,
  any
>
  ? Node
  : void;

type parseType<In extends string> = takeType<tokenize<In>> extends _match<infer Node, any>
  ? Node
  : void;

type parseOperation<In extends string> = takeOperation<tokenize<In>> extends _match<infer Node, any>
  ? Node
  : void;

export type DocumentNodeLike = {
  kind: Kind.DOCUMENT;
  definitions: readonly any[];
};

export type { parseConstValue, parseOperation, parseDocument, parseValue, parseType };
