import { describe, it, expectTypeOf } from 'vitest';

import type { simpleSchema } from './fixtures/simpleSchema';
import type { parseDocument } from '../parser';
import type { ResultOf, FragmentOf, mirrorFragmentTypeRec, getDocumentNode } from '../api';
import { readFragment } from '../api';

type schema = simpleSchema;
type value = { __value: true };
type data = { __data: true };

describe('mirrorFragmentTypeRec', () => {
  it('mirrors null and undefined', () => {
    expectTypeOf<mirrorFragmentTypeRec<value, data>>().toEqualTypeOf<data>();
    expectTypeOf<mirrorFragmentTypeRec<value | null, data>>().toEqualTypeOf<data | null>();
    expectTypeOf<mirrorFragmentTypeRec<value | undefined, data>>().toEqualTypeOf<
      data | undefined
    >();
    expectTypeOf<mirrorFragmentTypeRec<value | null | undefined, data>>().toEqualTypeOf<
      data | null | undefined
    >();
  });

  it('mirrors nested arrays', () => {
    expectTypeOf<mirrorFragmentTypeRec<value[], data>>().toEqualTypeOf<data[]>();
    expectTypeOf<mirrorFragmentTypeRec<value[] | null, data>>().toEqualTypeOf<data[] | null>();
    expectTypeOf<mirrorFragmentTypeRec<(value | null)[] | null, data>>().toEqualTypeOf<
      (data | null)[] | null
    >();
    expectTypeOf<mirrorFragmentTypeRec<readonly value[], data>>().toEqualTypeOf<readonly data[]>();
  });
});

describe('readFragment', () => {
  it('unmasks regular fragments', () => {
    type fragment = parseDocument<`
      fragment Fields on Todo {
        id
      }
    `>;

    type document = getDocumentNode<fragment, schema>;

    const document: document = {} as any;
    const data: FragmentOf<document> = {} as any;

    const result = readFragment(document, data);

    expectTypeOf<typeof result>().toEqualTypeOf<ResultOf<document>>();
  });

  it('unmasks fragments with optional spreads', () => {
    type fragment = parseDocument<`
      fragment Fields on Todo {
        ... @defer {
          id
        }
      }
    `>;

    type document = getDocumentNode<fragment, schema>;

    const document: document = {} as any;
    const data: FragmentOf<document> = {} as any;

    const result = readFragment(document, data);

    expectTypeOf<typeof result>().toEqualTypeOf<ResultOf<document>>();
  });
});
