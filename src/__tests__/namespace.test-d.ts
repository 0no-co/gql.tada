import { describe, it, expectTypeOf } from 'vitest';
import type { Kind } from '@0no-co/graphql.web';

import type { $tada, decorateFragmentDef, getFragmentsOfDocuments } from '../namespace';

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

    expectTypeOf<actual>().toMatchTypeOf<{
      fragment: 'TodoFragment';
      on: 'Todo';
    }>();
  });
});

describe('getFragmentsOfDocumentsRec', () => {
  type actual = getFragmentsOfDocuments<
    [
      {
        [$tada.definition]?: {
          fragment: 'TodoFragment';
          on: 'Todo';
          masked: true;
        };
      },
    ]
  >;

  type expected = {
    TodoFragment: {
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
      [$tada.ref]: {
        [$tada.fragmentRefs]: {
          TodoFragment: 'Todo';
        };
      };
    };
  };

  expectTypeOf<actual>().toMatchTypeOf<expected>();
});
