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
  : In extends `${'e' | 'E'}${string}`
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

export interface match<Result = any, In extends string = any> {
  out: Result;
  in: In;
}

export interface match3<ResultA = any, ResultB = any, In extends string = any> {
  outA: ResultA;
  outB: ResultB;
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

type takeName<In extends string> = takeNameLiteral<In> extends infer Match extends match
  ? match<NameNode<Match['out']>, Match['in']>
  : void;

type takeOptionalName<In extends string> = takeNameLiteral<In> extends infer Match extends match
  ? match<NameNode<Match['out']>, Match['in']>
  : match<undefined, In>;

interface EnumNode<Out> {
  kind: Kind.ENUM;
  value: Out;
}

type takeEnum<In extends string> = takeNameLiteral<In> extends infer Match extends match
  ? match<EnumNode<Match['out']>, Match['in']>
  : void;

interface VariableNode<Out> {
  kind: Kind.VARIABLE;
  name: NameNode<Out>;
}

type TakeVariable<In extends string, Const extends boolean> = Const extends false
  ? In extends `${'$'}${infer In}`
    ? takeNameLiteral<In> extends infer Match extends match
      ? match<VariableNode<Match['out']>, Match['in']>
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
  ? skipFloat<In> extends string
    ? match<FloatNode, skipFloat<In>>
    : match<IntNode, In>
  : void;

interface StringNode<IsBlock extends boolean> {
  kind: Kind.STRING;
  value: string;
  block: IsBlock;
}

type takeString<In> = In extends `${'"""'}${infer In}`
  ? skipBlockString<In> extends string
    ? match<StringNode<true>, skipBlockString<In>>
    : void
  : In extends `${'"'}${infer In}`
    ? skipString<In> extends string
      ? match<StringNode<false>, skipString<In>>
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

export type takeValue<
  In extends string,
  Const extends boolean,
> = takeLiteral<In> extends infer Match extends match
  ? Match
  : TakeVariable<In, Const> extends infer Match extends match
    ? Match
    : takeNumber<In> extends infer Match extends match
      ? Match
      : takeEnum<In> extends infer Match extends match
        ? Match
        : takeString<In> extends infer Match extends match
          ? Match
          : takeList<In, Const> extends infer Match extends match
            ? Match
            : takeObject<In, Const> extends infer Match extends match
              ? Match
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
  : takeValue<skipIgnored<In>, Const> extends infer Match extends match
    ? _takeListRec<[...Nodes, Match['out']], skipIgnored<Match['in']>, Const>
    : void;
export type takeList<In extends string, Const extends boolean> = In extends `${'['}${infer In}`
  ? _takeListRec<[], skipIgnored<In>, Const>
  : void;

interface ObjectFieldNode<Name, Value> {
  kind: Kind.OBJECT_FIELD;
  name: Name;
  value: Value;
}

type takeObjectField<
  In extends string,
  Const extends boolean,
> = takeName<In> extends infer Name extends match
  ? skipIgnored<Name['in']> extends `${':'}${infer In}`
    ? takeValue<skipIgnored<In>, Const> extends infer Value extends match
      ? match<ObjectFieldNode<Name['out'], Value['out']>, Value['in']>
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
  : takeObjectField<skipIgnored<In>, Const> extends infer Match extends match
    ? _takeObjectRec<[...Fields, Match['out']], skipIgnored<Match['in']>, Const>
    : void;
type takeObject<In extends string, Const extends boolean> = In extends `${'{'}${infer In}`
  ? _takeObjectRec<[], skipIgnored<In>, Const>
  : void;

interface ArgumentNode<Name, Value> {
  kind: Kind.ARGUMENT;
  name: Name;
  value: Value;
}

type takeArgument<
  In extends string,
  Const extends boolean,
> = takeName<In> extends infer Name extends match
  ? skipIgnored<Name['in']> extends `${':'}${infer In}`
    ? takeValue<skipIgnored<In>, Const> extends infer Value extends match
      ? match<ArgumentNode<Name['out'], Value['out']>, Value['in']>
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
  : takeArgument<In, Const> extends infer Argument extends match
    ? _takeArgumentsRec<[...Arguments, Argument['out']], skipIgnored<Argument['in']>, Const>
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
  ? takeName<In> extends infer Name extends match
    ? takeArguments<skipIgnored<Name['in']>, Const> extends infer Arguments extends match
      ? match<DirectiveNode<Name['out'], Arguments['out']>, Arguments['in']>
      : void
    : void
  : void;

type takeDirectivesRec<
  Directives extends any[],
  In extends string,
  Const extends boolean,
> = takeDirective<In, Const> extends infer Directive extends match
  ? takeDirectivesRec<[...Directives, Directive['out']], skipIgnored<Directive['in']>, Const>
  : match<Directives, In>;

type takeFieldName<In extends string> = takeName<In> extends infer MaybeAlias extends match
  ? skipIgnored<MaybeAlias['in']> extends `${':'}${infer In}`
    ? takeName<skipIgnored<In>> extends infer Name extends match
      ? match3<MaybeAlias['out'], Name['out'], Name['in']>
      : void
    : match3<undefined, MaybeAlias['out'], MaybeAlias['in']>
  : void;

interface FieldNode<Alias, Name, Arguments, Directives, SelectionSet> {
  kind: Kind.FIELD;
  alias: Alias;
  name: Name;
  arguments: Arguments;
  directives: Directives;
  selectionSet: SelectionSet;
}

export type takeField<In extends string> = takeFieldName<In> extends infer Names extends match3
  ? takeArguments<skipIgnored<Names['in']>, false> extends infer Arguments extends match
    ? takeDirectivesRec<[], skipIgnored<Arguments['in']>, false> extends infer Directives extends
        match
      ? takeSelectionSet<skipIgnored<Directives['in']>> extends infer SelectionSet extends match
        ? match<
            FieldNode<
              Names['outA'],
              Names['outB'],
              Arguments['out'],
              Directives['out'],
              SelectionSet['out']
            >,
            SelectionSet['in']
          >
        : match<
            FieldNode<Names['outA'], Names['outB'], Arguments['out'], Directives['out'], undefined>,
            Directives['in']
          >
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
  ? takeType<skipIgnored<In>> extends infer Subtype extends match
    ? skipIgnored<Subtype['in']> extends `${']'}${infer In}`
      ? skipIgnored<In> extends `${'!'}${infer In}`
        ? match<NonNullTypeNode<ListTypeNode<Subtype['out']>>, In>
        : match<ListTypeNode<Subtype['out']>, In>
      : void
    : void
  : takeName<skipIgnored<In>> extends infer Name extends match
    ? skipIgnored<Name['in']> extends `${'!'}${infer In}`
      ? match<NonNullTypeNode<NamedTypeNode<Name['out']>>, In>
      : match<NamedTypeNode<Name['out']>, Name['in']>
    : void;

type takeTypeCondition<In extends string> = In extends `${'on'}${infer In}`
  ? takeName<skipIgnored<In>> extends infer Name extends match
    ? match<NamedTypeNode<Name['out']>, Name['in']>
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
    ? takeName<skipIgnored<In>> extends infer Name extends match
      ? takeDirectivesRec<[], skipIgnored<Name['in']>, false> extends infer Directives extends match
        ? takeSelectionSet<skipIgnored<Directives['in']>> extends infer SelectionSet extends match
          ? match<
              InlineFragmentNode<
                NamedTypeNode<Name['out']>,
                Directives['out'],
                SelectionSet['out']
              >,
              SelectionSet['in']
            >
          : void
        : void
      : void
    : takeName<skipIgnored<In>> extends infer Name extends match
      ? takeDirectivesRec<[], skipIgnored<Name['in']>, false> extends infer Directives extends match
        ? match<FragmentSpreadNode<Name['out'], Directives['out']>, Directives['in']>
        : void
      : takeDirectivesRec<[], skipIgnored<In>, false> extends infer Directives extends match
        ? takeSelectionSet<skipIgnored<Directives['in']>> extends infer SelectionSet extends match
          ? match<
              InlineFragmentNode<undefined, Directives['out'], SelectionSet['out']>,
              SelectionSet['in']
            >
          : void
        : void
  : void;

interface SelectionSetNode<Selections> {
  kind: Kind.SELECTION_SET;
  selections: Selections;
}

type _takeSelectionRec<Selections extends any[], In extends string> = In extends `${'}'}${infer In}`
  ? match<SelectionSetNode<Selections>, In>
  : takeFragmentSpread<skipIgnored<In>> extends infer Selection extends match
    ? _takeSelectionRec<[...Selections, Selection['out']], skipIgnored<Selection['in']>>
    : takeField<skipIgnored<In>> extends infer Selection extends match
      ? _takeSelectionRec<[...Selections, Selection['out']], skipIgnored<Selection['in']>>
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

export type takeVarDefinition<In extends string> = TakeVariable<
  In,
  false
> extends infer Variable extends match
  ? skipIgnored<Variable['in']> extends `${':'}${infer In}`
    ? takeType<skipIgnored<In>> extends infer Type extends match
      ? skipIgnored<Type['in']> extends `${'='}${infer In}`
        ? takeValue<skipIgnored<In>, true> extends infer DefaultValue extends match
          ? takeDirectivesRec<
              [],
              skipIgnored<DefaultValue['in']>,
              true
            > extends infer Directives extends match
            ? match<
                VariableDefinitionNode<
                  Variable['out'],
                  Type['out'],
                  DefaultValue['out'],
                  Directives['out']
                >,
                Directives['in']
              >
            : void
          : void
        : takeDirectivesRec<[], skipIgnored<Type['in']>, true> extends infer Directives extends
              match
          ? match<
              VariableDefinitionNode<Variable['out'], Type['out'], undefined, Directives['out']>,
              Directives['in']
            >
          : void
      : void
    : void
  : void;

type _takeVarDefinitionRec<
  Definitions extends any[],
  In extends string,
> = In extends `${')'}${infer In}`
  ? match<Definitions, In>
  : takeVarDefinition<In> extends infer Definition extends match
    ? _takeVarDefinitionRec<[...Definitions, Definition['out']], skipIgnored<Definition['in']>>
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
  ? takeName<skipIgnored<In>> extends infer Name extends match
    ? takeTypeCondition<skipIgnored<Name['in']>> extends infer TypeCondition extends match
      ? takeDirectivesRec<
          [],
          skipIgnored<TypeCondition['in']>,
          true
        > extends infer Directives extends match
        ? takeSelectionSet<skipIgnored<Directives['in']>> extends infer SelectionSet extends match
          ? match<
              FragmentDefinitionNode<
                Name['out'],
                TypeCondition['out'],
                Directives['out'],
                SelectionSet['out']
              >,
              SelectionSet['in']
            >
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

export type takeOperationDefinition<In extends string> =
  TakeOperation<In> extends infer Operation extends match
    ? takeOptionalName<skipIgnored<Operation['in']>> extends infer Name extends match
      ? takeVarDefinitions<skipIgnored<Name['in']>> extends infer VarDefinitions extends match
        ? takeDirectivesRec<
            [],
            skipIgnored<VarDefinitions['in']>,
            false
          > extends infer Directives extends match
          ? takeSelectionSet<skipIgnored<Directives['in']>> extends infer SelectionSet extends match
            ? match<
                OperationDefinitionNode<
                  Operation['out'],
                  Name['out'],
                  VarDefinitions['out'],
                  Directives['out'],
                  SelectionSet['out']
                >,
                SelectionSet['in']
              >
            : void
          : void
        : void
      : void
    : takeSelectionSet<skipIgnored<In>> extends infer SelectionSet extends match
      ? match<
          OperationDefinitionNode<OperationTypeNode.QUERY, undefined, [], [], SelectionSet['out']>,
          SelectionSet['in']
        >
      : void;

type _takeDocumentRec<
  Definitions extends any[],
  In extends string,
> = takeFragmentDefinition<In> extends infer Definition extends match
  ? _takeDocumentRec<[...Definitions, Definition['out']], skipIgnored<Definition['in']>>
  : takeOperationDefinition<In> extends infer Definition extends match
    ? _takeDocumentRec<[...Definitions, Definition['out']], skipIgnored<Definition['in']>>
    : match<Definitions, In>;

interface DocumentNode<Definitions> {
  kind: Kind.DOCUMENT;
  definitions: Definitions;
}

type parseDocument<In extends string> = _takeDocumentRec<
  [],
  skipIgnored<In>
> extends infer Definitions extends match
  ? Definitions['out'] extends []
    ? never
    : DocumentNode<Definitions['out']>
  : never;

type parseValue<In extends string> = takeValue<skipIgnored<In>, false> extends infer Node extends
  match
  ? Node['out']
  : void;

type parseConstValue<In extends string> = takeValue<
  skipIgnored<In>,
  true
> extends infer Node extends match
  ? Node['out']
  : void;

type parseType<In extends string> = takeType<skipIgnored<In>> extends infer Node extends match
  ? Node['out']
  : void;

type parseOperation<In extends string> = TakeOperation<skipIgnored<In>> extends infer Node extends
  match
  ? Node['out']
  : void;

export type DocumentNodeLike = {
  kind: Kind.DOCUMENT;
  definitions: readonly any[];
};

export type { parseConstValue, parseOperation, parseDocument, parseValue, parseType };
