export const enum Token {
  Name,
  Var,
  Directive,
  Spread,
  Exclam,
  Equal,
  Colon,
  BraceOpen,
  BraceClose,
  ParenOpen,
  ParenClose,
  BracketOpen,
  BracketClose,
  BlockString,
  String,
  Integer,
  Float,
}

interface _match<Out extends string, In extends string> {
  out: Out;
  in: In;
}

type ignored = ' ' | '\n' | '\t' | '\r' | ',' | '\ufeff';

type digit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';

// prettier-ignore
type letter =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M'
  | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z'
  | 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l' | 'm'
  | 'n' | 'o' | 'p' | 'q' | 'r' | 's' | 't' | 'u' | 'v' | 'w' | 'x' | 'y' | 'z';

// PERF(@kitten): unions cause excessive instantiations
// Expanded literals are cheaper if an early case is more likely, and whitespaces then newlines are
type skipIgnored<In> = In extends `#${infer _}\n${infer In}`
  ? skipIgnored<In>
  : In extends `#${infer _}`
    ? ''
    : In extends ` ${infer In}`
      ? skipIgnored<In>
      : In extends `\n${infer In}`
        ? skipIgnored<In>
        : In extends `\t${infer In}`
          ? skipIgnored<In>
          : In extends `\r${infer In}`
            ? skipIgnored<In>
            : In extends `,${infer In}`
              ? skipIgnored<In>
              : In extends `\ufeff${infer In}`
                ? skipIgnored<In>
                : In;

type skipDigits<In> = In extends `${digit}${infer In}` ? skipDigits<In> : In;

type skipFloat<In> = In extends `${'.'}${infer In}`
  ? skipDigits<In> extends `${'e' | 'E'}${infer In}`
    ? skipDigits<In extends `${'+' | '-'}${infer In}` ? In : In>
    : skipDigits<In>
  : skipDigits<In> extends `${'e' | 'E'}${infer In}`
    ? skipDigits<In extends `${'+' | '-'}${infer In}` ? In : In>
    : void;

type skipBlockString<In> = In extends `${infer Hd}${'"""'}${infer In}`
  ? Hd extends `${string}${'\\'}`
    ? skipBlockString<In>
    : In
  : In;
type skipString<In> = In extends `${infer Hd}${'"'}${infer In}`
  ? Hd extends `${string}${'\\'}`
    ? skipString<In>
    : In
  : In;

type takeNameLiteralRec<
  PrevMatch extends string,
  In extends string,
> = In extends `${infer Match}${infer Out}`
  ? Match extends letter | digit | '_'
    ? takeNameLiteralRec<`${PrevMatch}${Match}`, Out>
    : _match<PrevMatch, In>
  : _match<PrevMatch, In>;

export interface VarTokenNode<Name extends string = string> {
  kind: Token.Var;
  name: Name;
}

export interface NameTokenNode<Name extends string = string> {
  kind: Token.Name;
  name: Name;
}

export interface DirectiveTokenNode<Name extends string = string> {
  kind: Token.Directive;
  name: Name;
}

export type TokenNode = Token | NameTokenNode | VarTokenNode | DirectiveTokenNode;

interface _state<In extends string, Out extends TokenNode[]> {
  out: Out;
  in: In;
}

interface _punctuator {
  '!': Token.Exclam;
  '=': Token.Equal;
  ':': Token.Colon;
  '{': Token.BraceOpen;
  '}': Token.BraceClose;
  '(': Token.ParenOpen;
  ')': Token.ParenClose;
  '[': Token.BracketOpen;
  ']': Token.BracketClose;
}

type tokenizeRec<State> =
  State extends _state<'', any>
    ? State['out']
    : State extends _state<infer In, infer Out>
      ? tokenizeRec<
          In extends `#${string}`
            ? _state<skipIgnored<In>, Out>
            : In extends `${infer Char}${infer Rest}`
              ? Char extends ignored
                ? _state<skipIgnored<In>, Out>
                : Char extends keyof _punctuator
                  ? _state<Rest, [...Out, _punctuator[Char]]>
                  : Char extends '"'
                    ? In extends `"""${infer In}`
                      ? _state<skipBlockString<In>, [...Out, Token.BlockString]>
                      : In extends `"${infer In}`
                        ? _state<skipString<In>, [...Out, Token.String]>
                        : void
                    : Char extends '.'
                      ? In extends `...${infer In}`
                        ? _state<In, [...Out, Token.Spread]>
                        : void
                      : Char extends '$'
                        ? takeNameLiteralRec<'', Rest> extends _match<infer Match, infer In>
                          ? _state<In, [...Out, VarTokenNode<Match>]>
                          : void
                        : Char extends '@'
                          ? takeNameLiteralRec<'', Rest> extends _match<infer Match, infer In>
                            ? _state<In, [...Out, DirectiveTokenNode<Match>]>
                            : void
                          : Char extends '-' | digit
                            ? In extends `-${digit}${infer In}`
                              ? skipFloat<skipDigits<In>> extends `${infer In}`
                                ? _state<In, [...Out, Token.Float]>
                                : _state<skipDigits<In>, [...Out, Token.Integer]>
                              : In extends `${digit}${infer In}`
                                ? skipFloat<skipDigits<In>> extends `${infer In}`
                                  ? _state<In, [...Out, Token.Float]>
                                  : _state<skipDigits<In>, [...Out, Token.Integer]>
                                : void
                            : Char extends letter | '_'
                              ? takeNameLiteralRec<Char, Rest> extends _match<infer Match, infer In>
                                ? _state<In, [...Out, NameTokenNode<Match>]>
                                : void
                              : void
              : void
        >
      : [];

export type tokenize<In extends string> = tokenizeRec<_state<In, []>>;
