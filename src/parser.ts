import type { Kind, OperationTypeNode } from '@0no-co/graphql.web';

type digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';

// prettier-ignore
type letter =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M'
  | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z'
  | 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l' | 'm'
  | 'n' | 'o' | 'p' | 'q' | 'r' | 's' | 't' | 'u' | 'v' | 'w' | 'x' | 'y' | 'z';

type skipIgnored<In> = In extends `#${infer _}\n${infer In}`
  ? skipIgnored<In>
  : In extends `${' ' | '\n' | '\t' | '\r' | ',' | '\ufeff'}${infer In}`
    ? skipIgnored<In>
    : In extends string
      ? In
      : never;

type skipDigits<In> = In extends `${digit}${infer In}` ? skipDigits<In> : In;
type skipInt<In> = In extends `${'-'}${digit}${infer In}`
  ? skipDigits<In>
  : In extends `${digit}${infer In}`
    ? skipDigits<In>
    : void;

type skipExponent<In> = In extends `${'e' | 'E'}${'+' | '-'}${infer In}`
  ? skipDigits<In>
  : In extends `${'e' | 'E'}${infer In}`
    ? skipDigits<In>
    : In;
type skipFloat<In> = In extends `${'.'}${infer In}`
  ? In extends `${digit}${infer In}`
    ? skipExponent<skipDigits<In>>
    : void
  : In extends `${'e' | 'E'}${infer _}`
    ? skipExponent<In>
    : void;

type skipBlockString<In> = In extends `${infer Hd}${'"""'}${infer In}`
  ? Hd extends `${infer _}${'\\'}`
    ? skipBlockString<skipIgnored<In>>
    : In
  : void;
type skipString<In> = In extends `${infer Hd}${'"'}${infer In}`
  ? Hd extends `${infer _}${'\\'}`
    ? skipString<In>
    : In
  : void;

type _takeNameLiteralRec<PrevMatch extends string, In> = In extends `${infer Match}${infer Out}`
  ? Match extends letter | digit | '_'
    ? _takeNameLiteralRec<`${PrevMatch}${Match}`, Out>
    : [PrevMatch, In]
  : [PrevMatch, In];
type takeNameLiteral<In> = In extends `${infer Match}${infer In}`
  ? Match extends letter | '_'
    ? _takeNameLiteralRec<Match, In>
    : void
  : void;

type takeName<In> = takeNameLiteral<In> extends [infer Out, infer In]
  ? [{ kind: Kind.NAME; value: Out }, In]
  : void;

type takeOptionalName<In> = takeNameLiteral<In> extends [infer Out, infer In]
  ? [{ kind: Kind.NAME; value: Out }, In]
  : [undefined, In];

type takeEnum<In> = takeNameLiteral<In> extends [infer Out, infer In]
  ? [{ kind: Kind.ENUM; value: Out }, In]
  : void;

type TakeVariable<In, Const> = Const extends false
  ? In extends `${'$'}${infer In}`
    ? takeNameLiteral<In> extends [infer Out, infer In]
      ? [{ kind: Kind.VARIABLE; name: { kind: Kind.NAME; value: Out } }, In]
      : void
    : void
  : void;

type takeNumber<In> = skipInt<In> extends `${infer In}`
  ? skipFloat<In> extends `${infer In}`
    ? [{ kind: Kind.FLOAT; value: string }, In]
    : [{ kind: Kind.INT; value: string }, In]
  : void;

type takeString<In> = In extends `${'"""'}${infer In}`
  ? skipBlockString<In> extends `${infer In}`
    ? [{ kind: Kind.STRING; value: string; block: true }, In]
    : void
  : In extends `${'"'}${infer In}`
    ? skipString<In> extends `${infer In}`
      ? [{ kind: Kind.STRING; value: string; block: false }, In]
      : void
    : void;

type takeLiteral<In> = In extends `${'null'}${infer In}`
  ? [{ kind: Kind.NULL }, In]
  : In extends `${'true' | 'false'}${infer In}`
    ? [{ kind: Kind.BOOLEAN; value: boolean }, In]
    : void;

export type takeValue<In, Const> = takeLiteral<In> extends [infer Node, infer Rest]
  ? [Node, Rest]
  : TakeVariable<In, Const> extends [infer Node, infer Rest]
    ? [Node, Rest]
    : takeNumber<In> extends [infer Node, infer Rest]
      ? [Node, Rest]
      : takeEnum<In> extends [infer Node, infer Rest]
        ? [Node, Rest]
        : takeString<In> extends [infer Node, infer Rest]
          ? [Node, Rest]
          : takeList<In, Const> extends [infer Node, infer Rest]
            ? [Node, Rest]
            : takeObject<In, Const> extends [infer Node, infer Rest]
              ? [Node, Rest]
              : void;

type _takeListRec<Nodes extends any[], In, Const> = In extends `${']'}${infer In}`
  ? [{ kind: Kind.LIST; values: Nodes }, In]
  : takeValue<skipIgnored<In>, Const> extends [infer Node, infer In]
    ? _takeListRec<[...Nodes, Node], skipIgnored<In>, Const>
    : void;
export type takeList<In, Const> = In extends `${'['}${infer In}`
  ? _takeListRec<[], skipIgnored<In>, Const>
  : void;

type takeObjectField<In, Const> = takeName<In> extends [infer Name, infer In]
  ? skipIgnored<In> extends `${':'}${infer In}`
    ? takeValue<skipIgnored<In>, Const> extends [infer Value, infer In]
      ? [{ kind: Kind.OBJECT_FIELD; name: Name; value: Value }, In]
      : void
    : void
  : void;

export type _takeObjectRec<Fields extends any[], In, Const> = In extends `${'}'}${infer In}`
  ? [{ kind: Kind.OBJECT; fields: Fields }, In]
  : takeObjectField<skipIgnored<In>, Const> extends [infer Field, infer In]
    ? _takeObjectRec<[...Fields, Field], skipIgnored<In>, Const>
    : void;
type takeObject<In, Const> = In extends `${'{'}${infer In}`
  ? _takeObjectRec<[], skipIgnored<In>, Const>
  : void;

type takeArgument<In, Const> = takeName<In> extends [infer Name, infer In]
  ? skipIgnored<In> extends `${':'}${infer In}`
    ? takeValue<skipIgnored<In>, Const> extends [infer Value, infer In]
      ? [{ kind: Kind.ARGUMENT; name: Name; value: Value }, In]
      : void
    : void
  : void;

type _takeArgumentsRec<Arguments extends any[], In, Const> = In extends `${')'}${infer In}`
  ? Arguments extends []
    ? void
    : [Arguments, In]
  : takeArgument<In, Const> extends [infer Argument, infer In]
    ? _takeArgumentsRec<[...Arguments, Argument], skipIgnored<In>, Const>
    : void;
export type takeArguments<In, Const> = In extends `${'('}${infer In}`
  ? _takeArgumentsRec<[], skipIgnored<In>, Const>
  : [[], In];

export type takeDirective<In, Const> = In extends `${'@'}${infer In}`
  ? takeName<In> extends [infer Name, infer In]
    ? takeArguments<skipIgnored<In>, Const> extends [infer Arguments, infer In]
      ? [{ kind: Kind.DIRECTIVE; name: Name; arguments: Arguments }, In]
      : void
    : void
  : void;

export type takeDirectives<In, Const> = takeDirective<In, Const> extends [infer Directive, infer In]
  ? takeDirectives<skipIgnored<In>, Const> extends [[...infer Directives], infer In]
    ? [[Directive, ...Directives], In]
    : [[], In]
  : [[], In];

type takeFieldName<In> = takeName<In> extends [infer MaybeAlias, infer In]
  ? skipIgnored<In> extends `${':'}${infer In}`
    ? takeName<skipIgnored<In>> extends [infer Name, infer In]
      ? [MaybeAlias, Name, In]
      : void
    : [undefined, MaybeAlias, In]
  : void;

export type takeField<In> = takeFieldName<In> extends [infer Alias, infer Name, infer In]
  ? takeArguments<skipIgnored<In>, false> extends [infer Arguments, infer In]
    ? takeDirectives<skipIgnored<In>, false> extends [infer Directives, infer In]
      ? takeSelectionSet<skipIgnored<In>> extends [infer SelectionSet, infer In]
        ? [
            {
              kind: Kind.FIELD;
              alias: Alias;
              name: Name;
              arguments: Arguments;
              directives: Directives;
              selectionSet: SelectionSet;
            },
            In,
          ]
        : [
            {
              kind: Kind.FIELD;
              alias: Alias;
              name: Name;
              arguments: Arguments;
              directives: Directives;
              selectionSet: undefined;
            },
            In,
          ]
      : void
    : void
  : void;

export type takeType<In> = In extends `${'['}${infer In}`
  ? takeType<skipIgnored<In>> extends [infer Subtype, infer In]
    ? In extends `${']'}${infer In}`
      ? skipIgnored<In> extends `${'!'}${infer In}`
        ? [{ kind: Kind.NON_NULL_TYPE; type: { kind: Kind.LIST_TYPE; type: Subtype } }, In]
        : [{ kind: Kind.LIST_TYPE; type: Subtype }, In]
      : void
    : void
  : takeName<skipIgnored<In>> extends [infer Name, infer In]
    ? skipIgnored<In> extends `${'!'}${infer In}`
      ? [{ kind: Kind.NON_NULL_TYPE; type: { kind: Kind.NAMED_TYPE; name: Name } }, In]
      : [{ kind: Kind.NAMED_TYPE; name: Name }, In]
    : void;

type takeTypeCondition<In> = In extends `${'on'}${infer In}`
  ? takeName<skipIgnored<In>> extends [infer Name, infer In]
    ? [{ kind: Kind.NAMED_TYPE; name: Name }, In]
    : void
  : void;

export type takeFragmentSpread<In> = In extends `${'...'}${infer In}`
  ? skipIgnored<In> extends `${'on'}${infer In}`
    ? takeName<skipIgnored<In>> extends [infer Name, infer In]
      ? takeDirectives<skipIgnored<In>, false> extends [infer Directives, infer In]
        ? takeSelectionSet<skipIgnored<In>> extends [infer SelectionSet, infer In]
          ? [
              {
                kind: Kind.INLINE_FRAGMENT;
                typeCondition: { kind: Kind.NAMED_TYPE; name: Name };
                directives: Directives;
                selectionSet: SelectionSet;
              },
              In,
            ]
          : void
        : void
      : void
    : takeName<skipIgnored<In>> extends [infer Name, infer In]
      ? takeDirectives<skipIgnored<In>, false> extends [infer Directives, infer In]
        ? [{ kind: Kind.FRAGMENT_SPREAD; name: Name; directives: Directives }, In]
        : void
      : takeDirectives<skipIgnored<In>, false> extends [infer Directives, infer In]
        ? takeSelectionSet<skipIgnored<In>> extends [infer SelectionSet, infer In]
          ? [
              {
                kind: Kind.INLINE_FRAGMENT;
                typeCondition: undefined;
                directives: Directives;
                selectionSet: SelectionSet;
              },
              In,
            ]
          : void
        : void
  : void;

type _takeSelectionRec<Selections extends any[], In> = In extends `${'}'}${infer In}`
  ? [{ kind: Kind.SELECTION_SET; selections: Selections }, In]
  : takeFragmentSpread<skipIgnored<In>> extends [infer Selection, infer In]
    ? _takeSelectionRec<[...Selections, Selection], skipIgnored<In>>
    : takeField<skipIgnored<In>> extends [infer Selection, infer In]
      ? _takeSelectionRec<[...Selections, Selection], skipIgnored<In>>
      : void;

export type takeSelectionSet<In> = In extends `${'{'}${infer In}`
  ? _takeSelectionRec<[], skipIgnored<In>>
  : void;

export type takeVarDefinition<In> = TakeVariable<In, false> extends [infer Variable, infer In]
  ? skipIgnored<In> extends `${':'}${infer In}`
    ? takeType<skipIgnored<In>> extends [infer Type, infer In]
      ? skipIgnored<In> extends `${'='}${infer In}`
        ? takeValue<skipIgnored<In>, true> extends [infer DefaultValue, infer In]
          ? takeDirectives<skipIgnored<In>, true> extends [infer Directives, infer In]
            ? [
                {
                  kind: Kind.VARIABLE_DEFINITION;
                  variable: Variable;
                  type: Type;
                  defaultValue: DefaultValue;
                  directives: Directives;
                },
                In,
              ]
            : void
          : void
        : takeDirectives<skipIgnored<In>, true> extends [infer Directives, infer In]
          ? [
              {
                kind: Kind.VARIABLE_DEFINITION;
                variable: Variable;
                type: Type;
                defaultValue: undefined;
                directives: Directives;
              },
              In,
            ]
          : void
      : void
    : void
  : void;

type _takeVarDefinitionRec<Definitions extends any[], In> = In extends `${')'}${infer In}`
  ? [Definitions, In]
  : takeVarDefinition<In> extends [infer Definition, infer In]
    ? _takeVarDefinitionRec<[...Definitions, Definition], skipIgnored<In>>
    : void;
export type takeVarDefinitions<In> = skipIgnored<In> extends `${'('}${infer In}`
  ? _takeVarDefinitionRec<[], skipIgnored<In>>
  : [[], In];

export type takeFragmentDefinition<In> = In extends `${'fragment'}${infer In}`
  ? takeName<skipIgnored<In>> extends [infer Name, infer In]
    ? takeTypeCondition<skipIgnored<In>> extends [infer TypeCondition, infer In]
      ? takeDirectives<skipIgnored<In>, true> extends [infer Directives, infer In]
        ? takeSelectionSet<skipIgnored<In>> extends [infer SelectionSet, infer In]
          ? [
              {
                kind: Kind.FRAGMENT_DEFINITION;
                name: Name;
                typeCondition: TypeCondition;
                directives: Directives;
                selectionSet: SelectionSet;
              },
              In,
            ]
          : void
        : void
      : void
    : void
  : void;

type TakeOperation<In> = In extends `${'query'}${infer In}`
  ? [OperationTypeNode.QUERY, In]
  : In extends `${'mutation'}${infer In}`
    ? [OperationTypeNode.MUTATION, In]
    : In extends `${'subscription'}${infer In}`
      ? [OperationTypeNode.SUBSCRIPTION, In]
      : void;

export type takeOperationDefinition<In> = TakeOperation<In> extends [infer Operation, infer In]
  ? takeOptionalName<skipIgnored<In>> extends [infer Name, infer In]
    ? takeVarDefinitions<skipIgnored<In>> extends [infer VarDefinitions, infer In]
      ? takeDirectives<skipIgnored<In>, false> extends [infer Directives, infer In]
        ? takeSelectionSet<skipIgnored<In>> extends [infer SelectionSet, infer In]
          ? [
              {
                kind: Kind.OPERATION_DEFINITION;
                operation: Operation;
                name: Name;
                variableDefinitions: VarDefinitions;
                directives: Directives;
                selectionSet: SelectionSet;
              },
              In,
            ]
          : void
        : void
      : void
    : void
  : takeSelectionSet<skipIgnored<In>> extends [infer SelectionSet, infer In]
    ? [
        {
          kind: Kind.OPERATION_DEFINITION;
          operation: OperationTypeNode.QUERY;
          name: undefined;
          variableDefinitions: [];
          directives: [];
          selectionSet: SelectionSet;
        },
        In,
      ]
    : void;

type _takeDocumentRec<Definitions extends any[], In> = takeFragmentDefinition<In> extends [
  infer Definition,
  infer In,
]
  ? _takeDocumentRec<[...Definitions, Definition], skipIgnored<In>>
  : takeOperationDefinition<In> extends [infer Definition, infer In]
    ? _takeDocumentRec<[...Definitions, Definition], skipIgnored<In>>
    : [Definitions, In];

type parseDocument<In> = _takeDocumentRec<[], skipIgnored<In>> extends [
  [...infer Definitions],
  infer _Rest,
]
  ? Definitions extends []
    ? never
    : { kind: Kind.DOCUMENT; definitions: Definitions }
  : never;

type parseValue<In> = takeValue<skipIgnored<In>, false> extends [infer Node, string] ? Node : void;

type parseConstValue<In> = takeValue<skipIgnored<In>, true> extends [infer Node, string]
  ? Node
  : void;

type parseType<In> = takeType<skipIgnored<In>> extends [infer Node, string] ? Node : void;

type parseOperation<In> = TakeOperation<skipIgnored<In>> extends [infer Node, string] ? Node : void;

export type DocumentNodeLike = {
  kind: Kind.DOCUMENT;
  definitions: readonly any[];
};

export type { parseConstValue, parseOperation, parseDocument, parseValue, parseType };
