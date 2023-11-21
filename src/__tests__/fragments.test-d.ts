import { assertType, test } from 'vitest';
import { Introspection } from '../introspection';
import { Document } from '../parser';
import { FragmentType } from '../typed-document/fragments';
import { schema } from './introspection.test-d';

type Intro = Introspection<typeof schema>;
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

  type doc = Document<typeof unionQuery>;
  type typedDoc = FragmentType<doc, Intro>;

  const actual = any as typedDoc;

  assertType<{
    id: string | number;
    text: string;
    complete: boolean | null;
    __typename: 'Todo';
  }>(actual);
});
