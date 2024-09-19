import type { Location } from '@0no-co/graphql.web';
import { describe, it, expect } from 'vitest';
import { concatLocSources } from '../utils';

const makeLocation = (input: string): Location => ({
  start: 0,
  end: input.length,
  source: {
    body: input,
    name: 'GraphQLTada',
    locationOffset: { line: 1, column: 1 },
  },
});

describe('concatLocSources', () => {
  it('outputs the fragments concatenated to one another', () => {
    const actual = concatLocSources([{ loc: makeLocation('a') }, { loc: makeLocation('b') }]);
    expect(actual).toBe('ab');
  });

  it('works when called recursively', () => {
    // NOTE: Should work repeatedly
    for (let i = 0; i < 2; i++) {
      const actual = concatLocSources([
        {
          get loc() {
            return makeLocation(
              concatLocSources([{ loc: makeLocation('a') }, { loc: makeLocation('b') }])
            );
          },
        },
        {
          get loc() {
            return makeLocation(
              concatLocSources([{ loc: makeLocation('c') }, { loc: makeLocation('d') }])
            );
          },
        },
      ]);
      expect(actual).toBe('abcd');
    }
  });

  it('deduplicates recursively', () => {
    // NOTE: Should work repeatedly
    for (let i = 0; i < 2; i++) {
      const a = { loc: makeLocation('a') };
      const b = { loc: makeLocation('b') };
      const c = { loc: makeLocation('c') };
      const d = { loc: makeLocation('d') };

      let actual = concatLocSources([
        {
          get loc() {
            return makeLocation(concatLocSources([a, b, c, d]));
          },
        },
        {
          get loc() {
            return makeLocation(
              concatLocSources([
                a,
                b,
                c,
                {
                  get loc() {
                    return makeLocation(concatLocSources([a, b, c, d]));
                  },
                },
              ])
            );
          },
        },
      ]);

      expect(actual).toBe('abcd');

      actual = concatLocSources([
        {
          get loc() {
            return makeLocation(
              concatLocSources([
                a,
                b,
                c,
                {
                  get loc() {
                    return makeLocation(concatLocSources([a, b, c, d]));
                  },
                },
              ])
            );
          },
        },
        {
          get loc() {
            return makeLocation(concatLocSources([a, b, c, d]));
          },
        },
      ]);

      expect(actual).toBe('abcd');
    }
  });
});
