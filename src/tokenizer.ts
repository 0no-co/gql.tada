export const enum Token {
  Name,
  Var,
  Spread,
  Exclam,
  Equal,
  Colon,
  AtSign,
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

type skipFloat<In> = In extends `${'.'}${infer In}`
  ? In extends `${digit}${infer In}`
    ? In extends `${'e' | 'E'}${infer In}`
      ? skipDigits<In extends `${'+' | '-'}${infer In}` ? In : In>
      : In
    : void
  : In extends `${'e' | 'E'}${infer In}`
    ? skipDigits<In extends `${'+' | '-'}${infer In}` ? In : In>
    : void;

type skipBlockString<In> = In extends `${infer Hd}${'"""'}${infer In}`
  ? Hd extends `${string}${'\\'}`
    ? skipBlockString<skipIgnored<In>>
    : skipIgnored<In>
  : In;
type skipString<In> = In extends `${infer Hd}${'"'}${infer In}`
  ? Hd extends `${string}${'\\'}`
    ? skipString<In>
    : skipIgnored<In>
  : In;

type takeNameLiteralRec<PrevMatch extends string, In> = In extends `${infer Match}${infer Out}`
  ? Match extends letter | digit | '_'
    ? takeNameLiteralRec<`${PrevMatch}${Match}`, Out>
    : [PrevMatch, In]
  : [PrevMatch, In];

export interface VarTokenNode<Name extends string = string> {
  kind: Token.Var;
  name: Name;
}

export interface NameTokenNode<Name extends string = string> {
  kind: Token.Name;
  name: Name;
}

export type TokenNode = Token | NameTokenNode | VarTokenNode;

// prettier-ignore
type tokenizeRec<In extends string, Out extends TokenNode[]> =
  In extends `...${infer In}` ? tokenizeRec<skipIgnored<In>, [...Out, Token.Spread]>
  : In extends `!${infer In}` ? tokenizeRec<skipIgnored<In>, [...Out, Token.Exclam]>
  : In extends `=${infer In}` ? tokenizeRec<skipIgnored<In>, [...Out, Token.Equal]>
  : In extends `:${infer In}` ? tokenizeRec<skipIgnored<In>, [...Out, Token.Colon]>
  : In extends `@${infer In}` ? tokenizeRec<skipIgnored<In>, [...Out, Token.AtSign]>
  : In extends `{${infer In}` ? tokenizeRec<skipIgnored<In>, [...Out, Token.BraceOpen]>
  : In extends `}${infer In}` ? tokenizeRec<skipIgnored<In>, [...Out, Token.BraceClose]>
  : In extends `(${infer In}` ? tokenizeRec<skipIgnored<In>, [...Out, Token.ParenOpen]>
  : In extends `)${infer In}` ? tokenizeRec<skipIgnored<In>, [...Out, Token.ParenClose]>
  : In extends `[${infer In}` ? tokenizeRec<skipIgnored<In>, [...Out, Token.BracketOpen]>
  : In extends `]${infer In}` ? tokenizeRec<skipIgnored<In>, [...Out, Token.BracketClose]>
  : In extends `"""${infer In}` ? tokenizeRec<skipBlockString<In>, [...Out, Token.BlockString]>
  : In extends `"${infer In}` ? tokenizeRec<skipString<In>, [...Out, Token.String]>
  : In extends `-${digit}${infer In}` ?
    (skipFloat<skipDigits<In>> extends `${infer In}`
      ? tokenizeRec<skipIgnored<In>, [...Out, Token.Float]>
      : tokenizeRec<skipIgnored<skipDigits<In>>, [...Out, Token.Integer]>)
  : In extends `${digit}${infer In}` ?
    (skipFloat<skipDigits<In>> extends `${infer In}`
      ? tokenizeRec<skipIgnored<In>, [...Out, Token.Float]>
      : tokenizeRec<skipIgnored<In>, [...Out, Token.Integer]>)
  : In extends `$${infer In}` ?
    (takeNameLiteralRec<'', In> extends [`${infer Match}`, infer In]
      ? tokenizeRec<skipIgnored<In>, [...Out, VarTokenNode<Match>]>
      : Out)
  : In extends `${letter | '_'}${string}` ?
    (takeNameLiteralRec<'', In> extends [`${infer Match}`, infer In]
      ? tokenizeRec<skipIgnored<In>, [...Out, NameTokenNode<Match>]>
      : Out)
  : Out;

export type tokenize<In> = tokenizeRec<skipIgnored<In>, []>;
