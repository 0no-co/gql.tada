import { describe, it, expectTypeOf } from 'vitest';
import type { mirrorFragmentTypeRec } from '../api';

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
