import { describe, it, expect } from 'vitest';
import {
  buildSchema,
  graphql,
  introspectionFromSchema,
  lexicographicSortSchema,
  printSchema,
} from 'graphql';

import { initSchemaBuilder } from '../builder';
import { createContextCache } from '../context';

const t = initSchemaBuilder();
const hello = t.object(t.objectRef()('Query'), {
  fields: (f) => ({ hello: f.field({ type: t.String, resolve: () => 'world' }) }),
});

describe('names', () => {
  it('supports names of Object.prototype properties', () => {
    const Constructor = t.objectRef<{ constructor: string }>()('constructor');
    const Kind = t.enum('toString', { values: ['constructor', 'valueOf'] });
    const Input = t.input('hasOwnProperty', {
      fields: { constructor: t.String, toString: t.Int },
    });
    const Directive = t.directive('valueOf', {
      locations: ['FIELD_DEFINITION'],
      args: { constructor: t.String, toString: { type: t.Int, defaultValue: 1 } },
    });
    const query = t.object(t.objectRef()('Query'), {
      fields: (f) => ({
        constructor: f.field({
          type: Constructor,
          args: { toString: Input },
          // NOTE: TypeScript sees `Object.prototype` properties on object literals, hence the cast
          directives: [t.apply(Directive, { constructor: 'x' } as any)],
          resolve: () => ({ constructor: 'value' }),
        }),
        kind: f.field({ type: Kind, resolve: () => 'constructor' as const }),
      }),
    });
    const ConstructorType = t.object(Constructor, {
      fields: (f) => ({ constructor: f.field({ type: t.String }) }),
    });

    const schema = t.schema({
      query,
      types: [ConstructorType, Kind, Input],
      directives: [Directive],
    });

    const expected = buildSchema(`
      directive @valueOf(constructor: String, toString: Int = 1) on FIELD_DEFINITION
      type Query { constructor(toString: hasOwnProperty): constructor kind: toString }
      type constructor { constructor: String }
      enum toString { constructor valueOf }
      input hasOwnProperty { constructor: String toString: Int }
    `);
    expect(printSchema(lexicographicSortSchema(schema))).toBe(
      printSchema(lexicographicSortSchema(expected))
    );
    expect((schema.getQueryType()!.getFields() as any).constructor.extensions.directives).toEqual([
      { name: 'valueOf', args: { constructor: 'x', toString: 1 } },
    ]);
  });

  it('rejects unknown directive arguments named like Object.prototype properties', () => {
    const Tag = t.directive('tag', { locations: ['OBJECT'] });
    const tagged = t.object(t.objectRef()('Query'), {
      directives: [t.apply(Tag, { toString: 1 } as any)],
    });
    expect(() => t.schema({ query: hello, types: [tagged], directives: [Tag] })).toThrow(
      'Directive "@tag" has no argument "toString" ("Query").'
    );
  });
});

describe('references', () => {
  it('checks the kind of every reference', () => {
    const Pet = t.object(t.objectRef()('Pet'), {
      fields: (f) => ({ name: f.field({ type: t.String, resolve: () => 'Tom' }) }),
    });
    const query = t.object(t.objectRef()('Query'), {
      fields: (f) => ({
        pet: f.field({ type: t.interfaceRef()('Pet'), resolve: () => null }),
      }),
    });
    expect(() => t.schema({ query, types: [Pet] })).toThrow(
      'Type "Pet" is referenced as INTERFACE but is a OBJECT.'
    );

    const string = t.object(t.objectRef()('Query'), {
      fields: (f) => ({ value: f.field({ type: t.objectRef()('String'), resolve: () => null }) }),
    });
    expect(() => t.schema({ query: string })).toThrow(
      'Type "String" is referenced as OBJECT but is a SCALAR.'
    );
  });

  it('throws when a definition is referenced without being passed to the schema', () => {
    const User = t.objectRef<{ id: string }>()('User');
    const UserType = t.object(User, {
      fields: (f) => ({ id: f.field({ type: t.ID }) }),
    });
    const UserExtension = t.object(User, {
      fields: (f) => ({ extra: f.field({ type: t.String, resolve: () => null }) }),
    });
    const query = t.object(t.objectRef()('Query'), {
      fields: (f) => ({ me: f.field({ type: UserType, resolve: () => null }) }),
    });
    expect(() => t.schema({ query, types: [UserExtension] })).toThrow(
      `Type "User" is referenced by a definition that wasn't passed to schema({ types }).`
    );
  });

  it('describes undefined types, e.g. from circular imports', () => {
    const query = t.object(t.objectRef()('Query'), {
      fields: (f) => ({ user: f.field({ type: undefined as any, resolve: () => null }) }),
    });
    expect(() => t.schema({ query } as any)).toThrow(
      'The type of "Query.user" is undefined. This may be caused by a circular import.'
    );
    expect(() => t.schema({ query: hello, types: [undefined] } as any)).toThrow(
      'schema({ types[0] }) received an undefined type. This may be caused by a circular import.'
    );
  });

  it('describes undefined directives and thunk results', () => {
    const applied = t.object(t.objectRef()('Query'), {
      directives: [t.apply(undefined as any)],
    });
    expect(() => t.schema({ query: hello, types: [applied] })).toThrow(
      'A directive applied to "Query" is undefined. This may be caused by a circular import.'
    );
    const Directive = t.directive('d', { locations: ['OBJECT'], args: { x: undefined as any } });
    const withArg = t.object(t.objectRef()('Query'), {
      directives: [t.apply(Directive, {} as any)],
    });
    expect(() =>
      t.schema({ query: hello, types: [withArg], directives: [Directive] } as any)
    ).toThrow('The type of "@d(x:)" is undefined. This may be caused by a circular import.');
    const thunk = t.object(t.objectRef()('Query'), { interfaces: () => undefined as any });
    expect(() => t.schema({ query: hello, types: [thunk] } as any)).toThrow(
      'The "interfaces" of "Query" are undefined. This may be caused by a circular import.'
    );
  });

  it('accepts functions returning interfaces and union members', () => {
    // Refs declared after their use, as happens with circular imports between modules
    const query = t.object(t.objectRef()('Query'), {
      fields: (f) => ({ node: f.field({ type: Node, resolve: () => ({ id: '1' }) }) }),
    });
    const NodeType = t.interface(t.interfaceRef()('Node'), {
      resolveType: () => 'User',
      fields: (f) => ({ id: f.field({ type: t.ID }) }),
    });
    const UserType = t.object(t.objectRef<{ id: string }>()('User'), {
      interfaces: () => [Node],
      fields: (f) => ({ id: f.field({ type: t.ID }) }),
    });
    const Search = t.union('Search', { types: () => [User] });
    const Node = t.interfaceRef()('Node');
    const User = t.objectRef<{ id: string }>()('User');
    const schema = t.schema({ query, types: [NodeType, UserType, Search] });
    expect(printSchema(schema)).toContain('type User implements Node');
    expect(printSchema(schema)).toContain('union Search = User');
  });
});

describe('specification rules', () => {
  const A = t.objectRef()('A');
  const I = t.interfaceRef()('I');
  const IType = t.interface(I, {
    fields: (f) => ({ id: f.field({ type: t.ID }) }),
  });

  it('rejects duplicate union members and interfaces (Spec: 3.6, 3.8)', () => {
    const AType = t.object(A, {
      interfaces: [I],
      fields: (f) => ({ id: f.field({ type: t.ID, resolve: () => null }) }),
    });
    const union = t.union('U', { types: [A, A] });
    expect(() => t.schema({ query: hello, types: [IType, AType, union] })).toThrow(
      'Type "U" includes "A" more than once.'
    );
    const extension = t.object(A, { interfaces: [I] });
    expect(() => t.schema({ query: hello, types: [IType, AType, extension] })).toThrow(
      'Type "A" implements "I" more than once.'
    );
  });

  it('requires different root operation types (Spec: 3.3.1)', () => {
    // @ts-expect-error: root types must be different
    expect(() => t.schema({ query: hello, mutation: hello })).toThrow(
      'Type "Query" is used for more than one root operation type, which must all be different.'
    );
  });

  it('requires valid directive locations (Spec: 3.13)', () => {
    const empty = t.directive('empty', { locations: [] });
    expect(() => t.schema({ query: hello, directives: [empty] })).toThrow(
      'Directive "@empty" must have at least one location.'
    );
    const unknown = t.directive('unknown', { locations: ['NOWHERE' as any] });
    expect(() => t.schema({ query: hello, directives: [unknown] })).toThrow(
      'Directive "@unknown" has an unknown location "NOWHERE".'
    );
  });

  it('rejects directives that reference themselves (Spec: 3.13)', () => {
    const Self: any = t.directive('self', {
      locations: ['ARGUMENT_DEFINITION'],
      args: {
        get arg() {
          return { type: t.String, directives: [t.apply(Self)] };
        },
      },
    });
    expect(() => t.schema({ query: hello, directives: [Self] } as any)).toThrow(
      'Directive "@self" must not reference itself.'
    );

    const InputRef = t.inputRef<{ field?: string | null }>()('In');
    const Indirect: any = t.directive('indirect', {
      locations: ['INPUT_FIELD_DEFINITION'],
      args: { arg: InputRef },
    });
    const In = t.input(InputRef, {
      fields: () => ({ field: { type: t.String, directives: [t.apply(Indirect)] } }),
    });
    expect(() => t.schema({ query: hello, types: [In], directives: [Indirect] } as any)).toThrow(
      'Directive "@indirect" must not reference itself.'
    );
  });

  it('only allows `subscribe` on the subscription root type', () => {
    const query = t.object(t.objectRef()('Query'), {
      fields: (f) => ({
        count: f.field({
          type: t.Int,
          async *subscribe() {
            yield 1;
          },
          resolve: (count) => count,
        }),
      }),
    });
    expect(() => t.schema({ query })).toThrow(
      'Field "Query.count" sets "subscribe", which is only allowed on the subscription root type.'
    );
  });

  it("doesn't combine applied directives and extensions.directives", () => {
    const Tag = t.directive('tag', { locations: ['OBJECT'] });
    const tagged = t.object(t.objectRef()('Query'), {
      directives: [t.apply(Tag)],
      extensions: { directives: [] },
    });
    expect(() => t.schema({ query: hello, types: [tagged], directives: [Tag] })).toThrow(
      '"Query" sets both "directives" and "extensions.directives", which may not be combined.'
    );
  });

  it('skips validation, including on execution, with assumeValid', async () => {
    const invalid = t.object(t.objectRef()('Query'), {
      fields: (f) => ({
        field: f.field({
          type: t.String,
          args: { required: { type: t.nonNull(t.String), deprecationReason: 'Old' } },
          resolve: () => null,
        }),
      }),
    });
    const schema = t.schema({ query: hello, types: [invalid], assumeValid: true });
    expect(await graphql({ schema, source: '{ hello }' })).toEqual({ data: { hello: 'world' } });
    expect(introspectionFromSchema(schema)).toBeTruthy();
  });
});

describe('createContextCache', () => {
  it('creates one value per context', () => {
    let created = 0;
    const cache = createContextCache((context: { id: number }) => ({
      id: context.id,
      n: created++,
    }));
    const a = { id: 1 };
    const b = { id: 2 };
    expect(cache(a)).toBe(cache(a));
    expect(cache(b)).not.toBe(cache(a));
    expect(created).toBe(2);
  });

  it('requires an object as the context', () => {
    let created = 0;
    const cache = createContextCache((_context: object) => created++);
    expect(() => cache(undefined as any)).toThrow(
      'createContextCache() requires the context to be an object, but received undefined.'
    );
    expect(() => cache(null as any)).toThrow('but received null.');
    expect(created).toBe(0);
  });

  it('shares values between resolvers of a request', async () => {
    const t = initSchemaBuilder<{ context: object }>();
    const lookups: string[][] = [];
    const loader = createContextCache((_context: object) => {
      const batch: string[] = [];
      lookups.push(batch);
      return (id: string) => {
        batch.push(id);
        return { id };
      };
    });
    const User = t.objectRef<{ id: string }>()('User');
    const UserType = t.object(User, { fields: (f) => ({ id: f.field({ type: t.ID }) }) });
    const query = t.object(t.objectRef()('Query'), {
      fields: (f) => ({
        a: f.field({ type: User, resolve: (_, _args, ctx) => loader(ctx)('a') }),
        b: f.field({ type: User, resolve: (_, _args, ctx) => loader(ctx)('b') }),
      }),
    });
    const schema = t.schema({ query, types: [UserType] });
    await graphql({ schema, source: '{ a { id } b { id } }', contextValue: {} });
    await graphql({ schema, source: '{ a { id } }', contextValue: {} });
    expect(lookups).toEqual([['a', 'b'], ['a']]);
  });
});
