import { assertType, test } from 'vitest';
import { simpleIntrospection } from './fixtures/simpleIntrospection';
import { parseDocument } from '../parser';
import { Introspection } from '../introspection';
import { FragmentType } from '../selection';

type Intro = Introspection<typeof simpleIntrospection>;

const any = {} as any;

test('creates a type for a given fragment', () => {
  const unionQuery = `
  fragment Fields on Todo {
    id
    text
    complete
    __typename
  }
`;

  type doc = parseDocument<typeof unionQuery>;
  type typedDoc = FragmentType<doc, Intro>;

  const actual = any as typedDoc;

  assertType<{
    id: string | number;
    text: string;
    complete: boolean | null;
    __typename: 'Todo';
  }>(actual);
});
