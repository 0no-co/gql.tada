/* eslint-disable no-console */
import { createServer } from 'node:http';
import { createHandler } from 'graphql-http/lib/use/http';
import { createDatabase, type Context } from './db.ts';
import { schema } from './schema/index.ts';
import { writeSchemaFile } from './schema-file.ts';

// Keeps `schema.graphql` up-to-date for editor tooling during development
if (process.env.NODE_ENV !== 'production') writeSchemaFile();

const db = createDatabase();

const handler = createHandler({
  schema,
  // A stand-in for real authentication, e.g. a session cookie or a bearer token
  context: (req) => {
    const userId = req.raw.headers['x-user-id'];
    return { db, viewerId: typeof userId === 'string' ? userId : null } satisfies Context;
  },
});

const server = createServer((req, res) => {
  if (req.url && req.url.startsWith('/graphql')) {
    handler(req, res);
  } else {
    res.writeHead(404).end();
  }
});

server.listen(4000, () => {
  console.log('GraphQL API listening on http://localhost:4000/graphql');
});
