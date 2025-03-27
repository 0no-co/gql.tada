import { describe, it, expectTypeOf } from 'vitest';
import type { Token, tokenize } from '../tokenizer';

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
    type actual = tokenize<'-1 1 123'>;
    type expected = [Token.Integer, Token.Integer, Token.Integer];
    expectTypeOf<actual>().toEqualTypeOf<expected>();
  });

  it('tokenizes floats', () => {
    type actual = tokenize<'1.0 1e2 1.0E-2'>;
    type expected = [Token.Float, Token.Float, Token.Float];
    expectTypeOf<actual>().toEqualTypeOf<expected>();

    type actual2 = tokenize<'1.00 1e22 1.00E-20'>;
    type expected2 = [Token.Float, Token.Float, Token.Float];
    expectTypeOf<actual2>().toEqualTypeOf<expected2>();
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
    type actual = tokenize<'test x'>;
    type expected = [{ kind: Token.Name; name: 'test' }, { kind: Token.Name; name: 'x' }];
    expectTypeOf<actual>().toEqualTypeOf<expected>();
  });

  it('tokenizes variables', () => {
    type actual = tokenize<'$test $x'>;
    type expected = [{ kind: Token.Var; name: 'test' }, { kind: Token.Var; name: 'x' }];
    expectTypeOf<actual>().toEqualTypeOf<expected>();
  });

  it('tokenizes directives', () => {
    type actual = tokenize<'@test @x'>;
    type expected = [{ kind: Token.Directive; name: 'test' }, { kind: Token.Directive; name: 'x' }];
    expectTypeOf<actual>().toEqualTypeOf<expected>();
  });

  it('skips trailing comments', () => {
    type actual = tokenize<'@test   # test'>;
    type expected = [{ kind: Token.Directive; name: 'test' }];
    expectTypeOf<actual>().toEqualTypeOf<expected>();
  });

  it('skips comments until a newline', () => {
    type actual = tokenize<'@test   # test \n   @x'>;
    type expected = [{ kind: Token.Directive; name: 'test' }, { kind: Token.Directive; name: 'x' }];
    expectTypeOf<actual>().toEqualTypeOf<expected>();
  });
});
