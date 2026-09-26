import { describe, it, expect } from 'vitest';
import { initSchemaBuilder } from '../builder';

describe('schema errors', () => {
  const t = initSchemaBuilder();
  const Query = t.objectRef()('Query');
  const hello = t.object(Query, {
    fields: (f) => ({ hello: f.field({ type: t.String, resolve: () => 'world' }) }),
  });

  it('throws when a referenced type is missing', () => {
    const User = t.objectRef<{ id: string }>()('User');
    const query = t.object(Query, {
      fields: (f) => ({ user: f.field({ type: User, resolve: () => null }) }),
    });
    // @ts-expect-error: `User` is missing from `types`
    expect(() => t.schema({ query })).toThrow(
      'Type "User" is referenced but no definition was passed to schema({ types }).'
    );
  });

  it('throws when an extension redefines a field', () => {
    const extension = t.object(Query, {
      fields: (f) => ({ hello: f.field({ type: t.String, resolve: () => 'again' }) }),
    });
    expect(() => t.schema({ query: hello, types: [extension] })).toThrow(
      'Field "Query.hello" is defined more than once.'
    );
  });

  it('throws when an enum extension redefines a value', () => {
    const Role = t.enumRef<'A'>()('Role');
    const query = t.object(Query, {
      fields: (f) => ({ role: f.field({ type: Role, resolve: () => 'A' as const }) }),
    });
    expect(() =>
      t.schema({
        query,
        types: [t.enum(Role, { values: ['A'] }), t.enum(Role, { values: ['A'] })],
      })
    ).toThrow('Enum value "Role.A" is defined more than once.');
  });

  it('throws when definitions set conflicting options', () => {
    const a = t.object(Query, { description: 'a' });
    const b = t.object(Query, { description: 'b' });
    expect(() => t.schema({ query: hello, types: [a, b] })).toThrow(
      'Type "Query" sets "description" in more than one definition.'
    );
  });

  it('throws when a name is used for different kinds of types', () => {
    const Hello = t.enum('Hello', { values: ['A'] });
    const HelloScalar = t.scalar('Hello', { serialize: (value: string) => value });
    expect(() => t.schema({ query: hello, types: [Hello, HelloScalar] })).toThrow(
      'Type "Hello" is defined as both ENUM and SCALAR.'
    );
  });

  it('throws when redefining built-in scalars or directives', () => {
    const String = t.scalar('String', { serialize: (value: string) => value });
    expect(() => t.schema({ query: hello, types: [String] })).toThrow(
      'Type "String" is a built-in scalar and may not be redefined.'
    );
    const skip = t.directive('skip', { locations: ['FIELD'] });
    expect(() => t.schema({ query: hello, directives: [skip] })).toThrow(
      'Directive "@skip" is a built-in directive and may not be redefined.'
    );
  });

  it('throws when applied directives are invalid', () => {
    const Tag = t.directive('tag', {
      locations: ['OBJECT'],
      args: { name: t.nonNull(t.String) },
    });
    const Other = t.directive('other', { locations: ['FIELD_DEFINITION'] });

    const unregistered = t.object(Query, { directives: [t.apply(Tag, { name: 'a' })] });
    expect(() => t.schema({ query: hello, types: [unregistered] })).toThrow(
      'Directive "@tag" is applied to "Query" but is missing from schema({ directives }).'
    );

    const repeated = t.object(Query, {
      directives: [t.apply(Tag, { name: 'a' }), t.apply(Tag, { name: 'b' })],
    });
    expect(() => t.schema({ query: hello, types: [repeated], directives: [Tag] })).toThrow(
      'Directive "@tag" is not repeatable but is applied to "Query" more than once.'
    );

    // @ts-expect-error: `@other` may not be used on OBJECT
    const location = t.object(Query, { directives: [t.apply(Other)] });
    expect(() => t.schema({ query: hello, types: [location], directives: [Other] })).toThrow(
      'Directive "@other" may not be used on OBJECT ("Query").'
    );

    // @ts-expect-error: missing required argument
    const missing = t.object(Query, { directives: [t.apply(Tag, {})] });
    expect(() => t.schema({ query: hello, types: [missing], directives: [Tag] })).toThrow(
      'Directive "@tag" requires argument "name" ("Query").'
    );
  });

  it('validates the schema against the specification', () => {
    const deprecated = t.object(Query, {
      fields: (f) => ({
        field: f.field({
          type: t.String,
          args: { required: { type: t.nonNull(t.String), deprecationReason: 'Old' } },
          resolve: () => null,
        }),
      }),
    });
    expect(() => t.schema({ query: hello, types: [deprecated] })).toThrow(
      'Required argument Query.field(required:) cannot be deprecated.'
    );
    // Validation may be skipped
    expect(() => t.schema({ query: hello, types: [deprecated], assumeValid: true })).not.toThrow();

    const Node = t.interfaceRef()('Node');
    const node = t.interface(Node, {
      fields: (f) => ({ id: f.field({ type: t.nonNull(t.ID) }) }),
    });
    const incomplete = t.object(t.objectRef()('Thing'), { interfaces: [Node], fields: () => ({}) });
    expect(() => t.schema({ query: hello, types: [node, incomplete] })).toThrow(
      'Interface field Node.id expected but Thing does not provide it.'
    );
  });
});
