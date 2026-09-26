import { Kind } from 'graphql';
import { createContextCache } from 'gql.tada/server';
import type { Context } from '../db.ts';
import { t } from './builder.ts';
import { Node } from './refs.ts';

const parseDate = (value: unknown): Date => {
  const date = typeof value === 'string' ? new Date(value) : new Date(NaN);
  if (Number.isNaN(date.getTime())) throw new TypeError(`Invalid DateTime: ${String(value)}`);
  return date;
};

export const DateTime = t.scalar('DateTime', {
  description: 'An ISO-8601 encoded UTC date string.',
  specifiedByURL: 'https://scalars.graphql.org/andimarek/date-time',
  serialize: (value: Date) => value.toISOString(),
  parseValue: parseDate,
  parseLiteral: (ast) => parseDate(ast.kind === Kind.STRING ? ast.value : undefined),
});

export const NodeType = t.interface(Node, {
  description: 'An object with a globally unique ID.',
  resolveType: (value) => ('text' in value ? 'Todo' : 'User'),
  fields: (f) => ({ id: f.field({ type: t.nonNull(t.ID) }) }),
});

// Created once per request, and shared by all resolvers of the request (like a DataLoader)
export const usersById = createContextCache(
  (context: Context) => new Map(context.db.users.map((user) => [user.id, user]))
);
