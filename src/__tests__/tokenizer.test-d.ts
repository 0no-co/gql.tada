import { describe, it, expectTypeOf } from 'vitest';
import type { Token, tokenize } from '../tokenizer';

describe('tokenize', () => {
  it('tokenizes symbols', () => {
    type actual = tokenize<'... ! = : $ @ { } ( ) [ ]'>;

    type expected = [
      Token.Spread,
      Token.Exclam,
      Token.Equal,
      Token.Colon,
      Token.Dollar,
      Token.AtSign,
      Token.BraceOpen,
      Token.BraceClose,
      Token.ParenOpen,
      Token.ParenClose,
      Token.BracketOpen,
      Token.BracketClose,
    ];

    expectTypeOf<actual>().toEqualTypeOf<expected>();
  });

  it('tokenizes integers', () => {
    type actual = tokenize<'-1 1'>;
    type expected = [Token.Integer, Token.Integer];
    expectTypeOf<actual>().toEqualTypeOf<expected>();
  });

  it('tokenizes floats', () => {
    type actual = tokenize<'1.0 1e2 1.0E-2'>;
    type expected = [Token.Float, Token.Float, Token.Float];
    expectTypeOf<actual>().toEqualTypeOf<expected>();
  });

  it('tokenizes strings', () => {
    type actual = tokenize<'"x" "\\""'>;
    type expected = [Token.String, Token.String];
    expectTypeOf<actual>().toEqualTypeOf<expected>();
  });

  it('tokenizes block strings', () => {
    type actual = tokenize<'"""x""" """\\""""""'>;
    type expected = [Token.BlockString, Token.BlockString];
    expectTypeOf<actual>().toEqualTypeOf<expected>();
  });

  it('tokenizes names', () => {
    type actual = tokenize<'test'>;
    type expected = [{ kind: Token.Name; name: 'test' }];
    expectTypeOf<actual>().toEqualTypeOf<expected>();
  });
});
