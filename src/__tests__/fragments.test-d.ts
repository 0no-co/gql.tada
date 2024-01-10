import { assertType, test } from 'vitest';
import { simpleIntrospection } from './fixtures/simpleIntrospection';
import { parseDocument } from '../parser';
import { mapIntrospection } from '../introspection';
import { FragmentType } from '../selection';

type introspection = mapIntrospection<typeof simpleIntrospection>;

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
  type typedDoc = FragmentType<doc, introspection>;

  const actual = any as typedDoc;

  assertType<{
    id: string | number;
    text: string;
    complete: boolean | null;
    __typename: 'Todo';
  }>(actual);
});
