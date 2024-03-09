import { describe, it, expectTypeOf } from 'vitest';

import type {
  Token,
  DirectiveTokenNode,
  NameTokenNode,
  VarTokenNode,
  tokenize,
} from '../tokenizer';

describe('tokenize', () => {
  it('tokenizes symbols', () => {
    type actual = tokenize<'... ! = : { } ( ) [ ]'>;

    type expected = [
      Token.Spread,
      Token.Exclam,
      Token.Equal,
      Token.Colon,
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
    type expected = [Token.String, Token.String];
    expectTypeOf<actual>().toEqualTypeOf<expected>();
  });

  it('tokenizes names', () => {
    type actual = tokenize<'test x'>;
    type expected = [NameTokenNode<'test'>, NameTokenNode<'x'>];
    expectTypeOf<actual>().toEqualTypeOf<expected>();
  });

  it('tokenizes variables', () => {
    type actual = tokenize<'$test $x'>;
    type expected = [VarTokenNode<NameTokenNode<'test'>>, VarTokenNode<NameTokenNode<'x'>>];
    expectTypeOf<actual>().toEqualTypeOf<expected>();
  });

  it('tokenizes directives', () => {
    type actual = tokenize<'@test @x'>;
    type expected = [
      DirectiveTokenNode<NameTokenNode<'test'>>,
      DirectiveTokenNode<NameTokenNode<'x'>>,
    ];
    expectTypeOf<actual>().toEqualTypeOf<expected>();
  });
});
