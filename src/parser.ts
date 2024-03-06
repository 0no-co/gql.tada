import type { Kind, OperationTypeNode } from '@0no-co/graphql.web';

type digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';

// prettier-ignore
type letter =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M'
  | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z'
  | 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l' | 'm'
  | 'n' | 'o' | 'p' | 'q' | 'r' | 's' | 't' | 'u' | 'v' | 'w' | 'x' | 'y' | 'z';

type skipIgnored<In extends string> = In extends `#${infer _}\n${infer In}`
  ? skipIgnored<In>
  : In extends `${' ' | '\n' | '\t' | '\r' | ',' | '\ufeff'}${infer In}`
    ? skipIgnored<In>
    : In extends string
      ? In
      : never;

type skipDigits<In extends string> = In extends `${digit}${infer In}` ? skipDigits<In> : In;
type skipInt<In> = In extends `${'-'}${digit}${infer In}`
  ? skipDigits<In>
  : In extends `${digit}${infer In}`
    ? skipDigits<In>
    : void;

type skipExponent<In extends string> = In extends `${'e' | 'E'}${'+' | '-'}${infer In}`
  ? skipDigits<In>
  : In extends `${'e' | 'E'}${infer In}`
    ? skipDigits<In>
    : In;
type skipFloat<In extends string> = In extends `${'.'}${infer In}`
  ? In extends `${digit}${infer In}`
    ? skipExponent<skipDigits<In>>
    : void
  : In extends `${'e' | 'E'}${infer _}`
    ? skipExponent<In>
    : void;

type skipBlockString<In extends string> = In extends `${infer Hd}${'"""'}${infer In}`
  ? Hd extends `${infer _}${'\\'}`
    ? skipBlockString<skipIgnored<In>>
    : In
  : void;
type skipString<In extends string> = In extends `${infer Hd}${'"'}${infer In}`
  ? Hd extends `${infer _}${'\\'}`
    ? skipString<In>
    : In
  : void;

interface match<Result, In extends string> {
  match: Result;
  in: In;
}

interface match3<ResultA, ResultB, In extends string> {
  matchA: ResultA;
  matchB: ResultB;
  in: In;
}

type _takeNameLiteralRec<
  PrevMatch extends string,
  In extends string,
> = In extends `${infer Match}${infer Out}`
  ? Match extends letter | digit | '_'
    ? _takeNameLiteralRec<`${PrevMatch}${Match}`, Out>
    : match<PrevMatch, In>
  : match<PrevMatch, In>;
type takeNameLiteral<In> = In extends `${infer Match}${infer In}`
  ? Match extends letter | '_'
    ? _takeNameLiteralRec<Match, In>
    : void
  : void;

interface NameNode<Out> {
  kind: Kind.NAME;
  value: Out;
}

type takeName<In extends string> = takeNameLiteral<In> extends match<infer Out, infer In>
  ? match<NameNode<Out>, In>
  : void;

type takeOptionalName<In extends string> = takeNameLiteral<In> extends match<infer Out, infer In>
  ? match<NameNode<Out>, In>
  : match<undefined, In>;

interface EnumNode<Out> {
  kind: Kind.ENUM;
  value: Out;
}

type takeEnum<In extends string> = takeNameLiteral<In> extends match<infer Out, infer In>
  ? match<EnumNode<Out>, In>
  : void;

interface VariableNode<Out> {
  kind: Kind.VARIABLE;
  name: NameNode<Out>;
}

type TakeVariable<In extends string, Const extends boolean> = Const extends false
  ? In extends `${'$'}${infer In}`
    ? takeNameLiteral<In> extends match<infer Out, infer In>
      ? match<VariableNode<Out>, In>
      : void
    : void
  : void;

interface FloatNode {
  kind: Kind.FLOAT;
  value: string;
}

interface IntNode {
  kind: Kind.INT;
  value: string;
}

type takeNumber<In extends string> = skipInt<In> extends `${infer In}`
  ? skipFloat<In> extends `${infer In}`
    ? match<FloatNode, In>
    : match<IntNode, In>
  : void;

interface StringNode<IsBlock extends boolean> {
  kind: Kind.STRING;
  value: string;
  block: IsBlock;
}

type takeString<In> = In extends `${'"""'}${infer In}`
  ? skipBlockString<In> extends `${infer In}`
    ? match<StringNode<true>, In>
    : void
  : In extends `${'"'}${infer In}`
    ? skipString<In> extends `${infer In}`
      ? match<StringNode<false>, In>
      : void
    : void;

interface NullNode {
  kind: Kind.NULL;
}

interface BooleanNode {
  kind: Kind.BOOLEAN;
  value: boolean;
}

type takeLiteral<In extends string> = In extends `${'null'}${infer In}`
  ? match<NullNode, In>
  : In extends `${'true' | 'false'}${infer In}`
    ? match<BooleanNode, In>
    : void;

export type takeValue<In extends string, Const extends boolean> = takeLiteral<In> extends match<
  infer Node,
  infer Rest
>
  ? match<Node, Rest>
  : TakeVariable<In, Const> extends match<infer Node, infer Rest>
    ? match<Node, Rest>
    : takeNumber<In> extends match<infer Node, infer Rest>
      ? match<Node, Rest>
      : takeEnum<In> extends match<infer Node, infer Rest>
        ? match<Node, Rest>
        : takeString<In> extends match<infer Node, infer Rest>
          ? match<Node, Rest>
          : takeList<In, Const> extends match<infer Node, infer Rest>
            ? match<Node, Rest>
            : takeObject<In, Const> extends match<infer Node, infer Rest>
              ? match<Node, Rest>
              : void;

interface ListNode<Values> {
  kind: Kind.LIST;
  values: Values;
}

type _takeListRec<
  Nodes extends any[],
  In extends string,
  Const extends boolean,
> = In extends `${']'}${infer In}`
  ? match<ListNode<Nodes>, In>
  : takeValue<skipIgnored<In>, Const> extends match<infer Node, infer In>
    ? _takeListRec<[...Nodes, Node], skipIgnored<In>, Const>
    : void;
export type takeList<In extends string, Const extends boolean> = In extends `${'['}${infer In}`
  ? _takeListRec<[], skipIgnored<In>, Const>
  : void;

interface ObjectFieldNode<Name, Value> {
  kind: Kind.OBJECT_FIELD;
  name: Name;
  value: Value;
}

type takeObjectField<In extends string, Const extends boolean> = takeName<In> extends match<
  infer Name,
  infer In
>
  ? skipIgnored<In> extends `${':'}${infer In}`
    ? takeValue<skipIgnored<In>, Const> extends match<infer Value, infer In>
      ? match<ObjectFieldNode<Name, Value>, In>
      : void
    : void
  : void;

interface ObjectNode<Fields> {
  kind: Kind.OBJECT;
  fields: Fields;
}

export type _takeObjectRec<
  Fields extends any[],
  In extends string,
  Const extends boolean,
> = In extends `${'}'}${infer In}`
  ? match<ObjectNode<Fields>, In>
  : takeObjectField<skipIgnored<In>, Const> extends match<infer Field, infer In>
    ? _takeObjectRec<[...Fields, Field], skipIgnored<In>, Const>
    : void;
type takeObject<In extends string, Const extends boolean> = In extends `${'{'}${infer In}`
  ? _takeObjectRec<[], skipIgnored<In>, Const>
  : void;

interface ArgumentNode<Name, Value> {
  kind: Kind.ARGUMENT;
  name: Name;
  value: Value;
}

type takeArgument<In extends string, Const extends boolean> = takeName<In> extends match<
  infer Name,
  infer In
>
  ? skipIgnored<In> extends `${':'}${infer In}`
    ? takeValue<skipIgnored<In>, Const> extends match<infer Value, infer In>
      ? match<ArgumentNode<Name, Value>, In>
      : void
    : void
  : void;

type _takeArgumentsRec<
  Arguments extends any[],
  In extends string,
  Const extends boolean,
> = In extends `${')'}${infer In}`
  ? Arguments extends []
    ? void
    : match<Arguments, In>
  : takeArgument<In, Const> extends match<infer Argument, infer In>
    ? _takeArgumentsRec<[...Arguments, Argument], skipIgnored<In>, Const>
    : void;
export type takeArguments<In extends string, Const extends boolean> = In extends `${'('}${infer In}`
  ? _takeArgumentsRec<[], skipIgnored<In>, Const>
  : match<[], In>;

interface DirectiveNode<Name, Arguments> {
  kind: Kind.DIRECTIVE;
  name: Name;
  arguments: Arguments;
}

export type takeDirective<In extends string, Const extends boolean> = In extends `${'@'}${infer In}`
  ? takeName<In> extends match<infer Name, infer In>
    ? takeArguments<skipIgnored<In>, Const> extends match<infer Arguments, infer In>
      ? match<DirectiveNode<Name, Arguments>, In>
      : void
    : void
  : void;

export type takeDirectives<In extends string, Const extends boolean> = takeDirective<
  In,
  Const
> extends match<infer Directive, infer In>
  ? takeDirectives<skipIgnored<In>, Const> extends match<[...infer Directives], infer In>
    ? match<[Directive, ...Directives], In>
    : match<[], In>
  : match<[], In>;

// TODO
type takeFieldName<In extends string> = takeName<In> extends match<infer MaybeAlias, infer In>
  ? skipIgnored<In> extends `${':'}${infer In}`
    ? takeName<skipIgnored<In>> extends match<infer Name, infer In>
      ? match3<MaybeAlias, Name, In>
      : void
    : match3<undefined, MaybeAlias, In>
  : void;

interface FieldNode<Alias, Name, Arguments, Directives, SelectionSet> {
  kind: Kind.FIELD;
  alias: Alias;
  name: Name;
  arguments: Arguments;
  directives: Directives;
  selectionSet: SelectionSet;
}

export type takeField<In extends string> = takeFieldName<In> extends match3<
  infer Alias,
  infer Name,
  infer In
>
  ? takeArguments<skipIgnored<In>, false> extends match<infer Arguments, infer In>
    ? takeDirectives<skipIgnored<In>, false> extends match<infer Directives, infer In>
      ? takeSelectionSet<skipIgnored<In>> extends match<infer SelectionSet, infer In>
        ? match<FieldNode<Alias, Name, Arguments, Directives, SelectionSet>, In>
        : match<FieldNode<Alias, Name, Arguments, Directives, undefined>, In>
      : void
    : void
  : void;

interface NamedTypeNode<Name> {
  kind: Kind.NAMED_TYPE;
  name: Name;
}

interface NonNullTypeNode<OfType> {
  kind: Kind.NON_NULL_TYPE;
  type: OfType;
}

interface ListTypeNode<OfType> {
  kind: Kind.LIST_TYPE;
  type: OfType;
}

export type takeType<In extends string> = In extends `${'['}${infer In}`
  ? takeType<skipIgnored<In>> extends match<infer Subtype, infer In>
    ? In extends `${']'}${infer In}`
      ? skipIgnored<In> extends `${'!'}${infer In}`
        ? match<NonNullTypeNode<ListTypeNode<Subtype>>, In>
        : match<ListTypeNode<Subtype>, In>
      : void
    : void
  : takeName<skipIgnored<In>> extends match<infer Name, infer In>
    ? skipIgnored<In> extends `${'!'}${infer In}`
      ? match<NonNullTypeNode<NamedTypeNode<Name>>, In>
      : match<NamedTypeNode<Name>, In>
    : void;

type takeTypeCondition<In extends string> = In extends `${'on'}${infer In}`
  ? takeName<skipIgnored<In>> extends match<infer Name, infer In>
    ? match<NamedTypeNode<Name>, In>
    : void
  : void;

interface InlineFragmentNode<TypeCondition, Directives, SelectionSet> {
  kind: Kind.INLINE_FRAGMENT;
  typeCondition: TypeCondition;
  directives: Directives;
  selectionSet: SelectionSet;
}

interface FragmentSpreadNode<Name, Directives> {
  kind: Kind.FRAGMENT_SPREAD;
  name: Name;
  directives: Directives;
}

export type takeFragmentSpread<In extends string> = In extends `${'...'}${infer In}`
  ? skipIgnored<In> extends `${'on'}${infer In}`
    ? takeName<skipIgnored<In>> extends match<infer Name, infer In>
      ? takeDirectives<skipIgnored<In>, false> extends match<infer Directives, infer In>
        ? takeSelectionSet<skipIgnored<In>> extends match<infer SelectionSet, infer In>
          ? match<InlineFragmentNode<NamedTypeNode<Name>, Directives, SelectionSet>, In>
          : void
        : void
      : void
    : takeName<skipIgnored<In>> extends match<infer Name, infer In>
      ? takeDirectives<skipIgnored<In>, false> extends match<infer Directives, infer In>
        ? match<FragmentSpreadNode<Name, Directives>, In>
        : void
      : takeDirectives<skipIgnored<In>, false> extends match<infer Directives, infer In>
        ? takeSelectionSet<skipIgnored<In>> extends match<infer SelectionSet, infer In>
          ? match<InlineFragmentNode<undefined, Directives, SelectionSet>, In>
          : void
        : void
  : void;

interface SelectionSetNode<Selections> {
  kind: Kind.SELECTION_SET;
  selections: Selections;
}

type _takeSelectionRec<Selections extends any[], In extends string> = In extends `${'}'}${infer In}`
  ? match<SelectionSetNode<Selections>, In>
  : takeFragmentSpread<skipIgnored<In>> extends match<infer Selection, infer In>
    ? _takeSelectionRec<[...Selections, Selection], skipIgnored<In>>
    : takeField<skipIgnored<In>> extends match<infer Selection, infer In>
      ? _takeSelectionRec<[...Selections, Selection], skipIgnored<In>>
      : void;

export type takeSelectionSet<In extends string> = In extends `${'{'}${infer In}`
  ? _takeSelectionRec<[], skipIgnored<In>>
  : void;

interface VariableDefinitionNode<Variable, Type, DefaultValue, Directives> {
  kind: Kind.VARIABLE_DEFINITION;
  variable: Variable;
  type: Type;
  defaultValue: DefaultValue;
  directives: Directives;
}

export type takeVarDefinition<In extends string> = TakeVariable<In, false> extends match<
  infer Variable,
  infer In
>
  ? skipIgnored<In> extends `${':'}${infer In}`
    ? takeType<skipIgnored<In>> extends match<infer Type, infer In>
      ? skipIgnored<In> extends `${'='}${infer In}`
        ? takeValue<skipIgnored<In>, true> extends match<infer DefaultValue, infer In>
          ? takeDirectives<skipIgnored<In>, true> extends match<infer Directives, infer In>
            ? match<VariableDefinitionNode<Variable, Type, DefaultValue, Directives>, In>
            : void
          : void
        : takeDirectives<skipIgnored<In>, true> extends match<infer Directives, infer In>
          ? match<VariableDefinitionNode<Variable, Type, undefined, Directives>, In>
          : void
      : void
    : void
  : void;

type _takeVarDefinitionRec<
  Definitions extends any[],
  In extends string,
> = In extends `${')'}${infer In}`
  ? match<Definitions, In>
  : takeVarDefinition<In> extends match<infer Definition, infer In>
    ? _takeVarDefinitionRec<[...Definitions, Definition], skipIgnored<In>>
    : void;
export type takeVarDefinitions<In extends string> = skipIgnored<In> extends `${'('}${infer In}`
  ? _takeVarDefinitionRec<[], skipIgnored<In>>
  : match<[], In>;

interface FragmentDefinitionNode<Name, TypeCondition, Directives, SelectionSet> {
  kind: Kind.FRAGMENT_DEFINITION;
  name: Name;
  typeCondition: TypeCondition;
  directives: Directives;
  selectionSet: SelectionSet;
}

export type takeFragmentDefinition<In extends string> = In extends `${'fragment'}${infer In}`
  ? takeName<skipIgnored<In>> extends match<infer Name, infer In>
    ? takeTypeCondition<skipIgnored<In>> extends match<infer TypeCondition, infer In>
      ? takeDirectives<skipIgnored<In>, true> extends match<infer Directives, infer In>
        ? takeSelectionSet<skipIgnored<In>> extends match<infer SelectionSet, infer In>
          ? match<FragmentDefinitionNode<Name, TypeCondition, Directives, SelectionSet>, In>
          : void
        : void
      : void
    : void
  : void;

type TakeOperation<In extends string> = In extends `${'query'}${infer In}`
  ? match<OperationTypeNode.QUERY, In>
  : In extends `${'mutation'}${infer In}`
    ? match<OperationTypeNode.MUTATION, In>
    : In extends `${'subscription'}${infer In}`
      ? match<OperationTypeNode.SUBSCRIPTION, In>
      : void;

interface OperationDefinitionNode<Operation, Name, VarDefinitions, Directives, SelectionSet> {
  kind: Kind.OPERATION_DEFINITION;
  operation: Operation;
  name: Name;
  variableDefinitions: VarDefinitions;
  directives: Directives;
  selectionSet: SelectionSet;
}

export type takeOperationDefinition<In extends string> = TakeOperation<In> extends match<
  infer Operation,
  infer In
>
  ? takeOptionalName<skipIgnored<In>> extends match<infer Name, infer In>
    ? takeVarDefinitions<skipIgnored<In>> extends match<infer VarDefinitions, infer In>
      ? takeDirectives<skipIgnored<In>, false> extends match<infer Directives, infer In>
        ? takeSelectionSet<skipIgnored<In>> extends match<infer SelectionSet, infer In>
          ? match<
              OperationDefinitionNode<Operation, Name, VarDefinitions, Directives, SelectionSet>,
              In
            >
          : void
        : void
      : void
    : void
  : takeSelectionSet<skipIgnored<In>> extends match<infer SelectionSet, infer In>
    ? match<OperationDefinitionNode<OperationTypeNode.QUERY, undefined, [], [], SelectionSet>, In>
    : void;

type _takeDocumentRec<
  Definitions extends any[],
  In extends string,
> = takeFragmentDefinition<In> extends match<infer Definition, infer In>
  ? _takeDocumentRec<[...Definitions, Definition], skipIgnored<In>>
  : takeOperationDefinition<In> extends match<infer Definition, infer In>
    ? _takeDocumentRec<[...Definitions, Definition], skipIgnored<In>>
    : match<Definitions, In>;

interface DocumentNode<Definitions> {
  kind: Kind.DOCUMENT;
  definitions: Definitions;
}

type parseDocument<In extends string> = _takeDocumentRec<[], skipIgnored<In>> extends match<
  [...infer Definitions],
  infer _Rest
>
  ? Definitions extends []
    ? never
    : DocumentNode<Definitions>
  : never;

type parseValue<In extends string> = takeValue<skipIgnored<In>, false> extends match<
  infer Node,
  any
>
  ? Node
  : void;

type parseConstValue<In extends string> = takeValue<skipIgnored<In>, true> extends match<
  infer Node,
  any
>
  ? Node
  : void;

type parseType<In extends string> = takeType<skipIgnored<In>> extends match<infer Node, any>
  ? Node
  : void;

type parseOperation<In extends string> = TakeOperation<skipIgnored<In>> extends match<
  infer Node,
  any
>
  ? Node
  : void;

export type DocumentNodeLike = {
  kind: Kind.DOCUMENT;
  definitions: readonly any[];
};

export type { parseConstValue, parseOperation, parseDocument, parseValue, parseType };
