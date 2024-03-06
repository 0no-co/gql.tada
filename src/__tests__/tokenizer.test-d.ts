import { describe, it, expectTypeOf } from 'vitest';
import type { Token, tokenize, AnonymousTokenNode } from '../tokenizer';

describe('tokenize', () => {
  it('tokenizes symbols', () => {
    type actual = tokenize<'... ! = : $ @ { } ( ) [ ]'>;

    type expected = [
      AnonymousTokenNode<Token.Spread>,
      AnonymousTokenNode<Token.Exclam>,
      AnonymousTokenNode<Token.Equal>,
      AnonymousTokenNode<Token.Colon>,
      AnonymousTokenNode<Token.Dollar>,
      AnonymousTokenNode<Token.AtSign>,
      AnonymousTokenNode<Token.BraceOpen>,
      AnonymousTokenNode<Token.BraceClose>,
      AnonymousTokenNode<Token.ParenOpen>,
      AnonymousTokenNode<Token.ParenClose>,
      AnonymousTokenNode<Token.BracketOpen>,
      AnonymousTokenNode<Token.BracketClose>,
    ];

    expectTypeOf<actual>().toEqualTypeOf<expected>();
  });

  it('tokenizes integers', () => {
    type actual = tokenize<'-1 1'>;

    type expected = [AnonymousTokenNode<Token.Integer>, AnonymousTokenNode<Token.Integer>];

    expectTypeOf<actual>().toEqualTypeOf<expected>();
  });

  it('tokenizes floats', () => {
    type actual = tokenize<'1.0 1e2 1.0E-2'>;

    type expected = [
      AnonymousTokenNode<Token.Float>,
      AnonymousTokenNode<Token.Float>,
      AnonymousTokenNode<Token.Float>,
    ];

    expectTypeOf<actual>().toEqualTypeOf<expected>();
  });

  it('tokenizes strings', () => {
    type actual = tokenize<'"x" "\\""'>;

    type expected = [AnonymousTokenNode<Token.String>, AnonymousTokenNode<Token.String>];

    expectTypeOf<actual>().toEqualTypeOf<expected>();
  });

  it('tokenizes block strings', () => {
    type actual = tokenize<'"""x""" """\\""""""'>;

    type expected = [AnonymousTokenNode<Token.BlockString>, AnonymousTokenNode<Token.BlockString>];

    expectTypeOf<actual>().toEqualTypeOf<expected>();
  });
});
