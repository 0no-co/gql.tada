import { assertType, test } from 'vitest';
import { Introspection } from '../introspection';
import { Document } from '../parser';
import { Variables } from '../typed-document/variables';
import { schema } from './introspection.test-d';

type Intro = Introspection<typeof schema>;
const any = {} as any;

test('parses document-variables correctly', () => {
  const query = `
    mutation ($id: ID!) {
      toggleTodo { id }
    }
  `;
  type doc = Document<typeof query>;
  type variables = Variables<doc, Intro>;

  const actual = any as variables;

  assertType<{ id: string | number }>(actual);
});
