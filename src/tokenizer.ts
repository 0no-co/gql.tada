export const enum Token {
  Name,
  Spread,
  Exclam,
  Equal,
  Colon,
  Dollar,
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
    : [Match, In]
  : [PrevMatch, In];

export interface AnonymousTokenNode<
  Kind extends Exclude<Token, Token.Name> = Exclude<Token, Token.Name>,
> {
  kind: Kind;
}

export interface NameTokenNode<Name extends string = string> {
  kind: Token.Name;
  name: Name;
}

export type TokenNode = AnonymousTokenNode | NameTokenNode;

// prettier-ignore
type tokenizeRec<In extends string, Out extends TokenNode[]> =
  In extends `...${infer In}` ? tokenizeRec<skipIgnored<In>, [...Out, AnonymousTokenNode<Token.Spread>]>
  : In extends `!${infer In}` ? tokenizeRec<skipIgnored<In>, [...Out, AnonymousTokenNode<Token.Exclam>]>
  : In extends `=${infer In}` ? tokenizeRec<skipIgnored<In>, [...Out, AnonymousTokenNode<Token.Equal>]>
  : In extends `:${infer In}` ? tokenizeRec<skipIgnored<In>, [...Out, AnonymousTokenNode<Token.Colon>]>
  : In extends `$${infer In}` ? tokenizeRec<skipIgnored<In>, [...Out, AnonymousTokenNode<Token.Dollar>]>
  : In extends `@${infer In}` ? tokenizeRec<skipIgnored<In>, [...Out, AnonymousTokenNode<Token.AtSign>]>
  : In extends `{${infer In}` ? tokenizeRec<skipIgnored<In>, [...Out, AnonymousTokenNode<Token.BraceOpen>]>
  : In extends `}${infer In}` ? tokenizeRec<skipIgnored<In>, [...Out, AnonymousTokenNode<Token.BraceClose>]>
  : In extends `(${infer In}` ? tokenizeRec<skipIgnored<In>, [...Out, AnonymousTokenNode<Token.ParenOpen>]>
  : In extends `)${infer In}` ? tokenizeRec<skipIgnored<In>, [...Out, AnonymousTokenNode<Token.ParenClose>]>
  : In extends `[${infer In}` ? tokenizeRec<skipIgnored<In>, [...Out, AnonymousTokenNode<Token.BracketOpen>]>
  : In extends `]${infer In}` ? tokenizeRec<skipIgnored<In>, [...Out, AnonymousTokenNode<Token.BracketClose>]>
  : In extends `"""${infer In}` ? tokenizeRec<skipBlockString<In>, [...Out, AnonymousTokenNode<Token.BlockString>]>
  : In extends `"${infer In}` ? tokenizeRec<skipString<In>, [...Out, AnonymousTokenNode<Token.String>]>
  : In extends `-${digit}${infer In}` ?
    (skipFloat<skipDigits<In>> extends `${infer In}`
      ? tokenizeRec<skipIgnored<In>, [...Out, AnonymousTokenNode<Token.Float>]>
      : tokenizeRec<skipIgnored<skipDigits<In>>, [...Out, AnonymousTokenNode<Token.Integer>]>)
  : In extends `${digit}${infer In}` ?
    (skipFloat<skipDigits<In>> extends `${infer In}`
      ? tokenizeRec<skipIgnored<In>, [...Out, AnonymousTokenNode<Token.Float>]>
      : tokenizeRec<skipIgnored<In>, [...Out, AnonymousTokenNode<Token.Integer>]>)
  : In extends `${infer Match}${infer In}` ?
    (Match extends letter | '_'
      ? takeNameLiteralRec<Match, In> extends [`${infer Match}`, infer In]
        ? tokenizeRec<skipIgnored<In>, [...Out, NameTokenNode<Match>]>
        : Out
      : Out)
  : Out;

export type tokenize<In extends string> = tokenizeRec<skipIgnored<In>, []>;
