import { describe, it, expectTypeOf } from 'vitest';
import type { Kind } from '@0no-co/graphql.web';

import type { $tada, decorateFragmentDef, getFragmentsOfDocumentsRec } from '../namespace';

describe('decorateFragmentDef', () => {
  it('creates an annotated fragment definition', () => {
    type input = {
      kind: Kind.DOCUMENT;
      definitions: [
        {
          kind: Kind.FRAGMENT_DEFINITION;
          name: {
            kind: Kind.NAME;
            value: 'TodoFragment';
          };
          typeCondition: {
            kind: Kind.NAMED_TYPE;
            name: {
              kind: Kind.NAME;
              value: 'Todo';
            };
          };
          directives: unknown;
          selectionSet: unknown;
        },
      ];
    };

    type actual = decorateFragmentDef<input>;
    type expected = {
      kind: Kind.FRAGMENT_DEFINITION;
      name: {
        kind: Kind.NAME;
        value: 'TodoFragment';
      };
      typeCondition: {
        kind: Kind.NAMED_TYPE;
        name: {
          kind: Kind.NAME;
          value: 'Todo';
        };
      };
      readonly [$tada.fragmentId]: symbol;
    };

    expectTypeOf<actual>().toMatchTypeOf<expected>();
  });
});

describe('getFragmentsOfDocumentsRec', () => {
  type inputFragmentDef = {
    kind: Kind.FRAGMENT_DEFINITION;
    name: {
      kind: Kind.NAME;
      value: 'TodoFragment';
    };
    typeCondition: {
      kind: Kind.NAMED_TYPE;
      name: {
        kind: Kind.NAME;
        value: 'Todo';
      };
    };
    readonly [$tada.fragmentId]: unique symbol;
  };

  type input = {
    [$tada.definition]?: inputFragmentDef;
  };

  type actual = getFragmentsOfDocumentsRec<[input]>;
  type expected = { TodoFragment: inputFragmentDef };

  expectTypeOf<actual>().toMatchTypeOf<expected>();
});
