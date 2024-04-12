import { expect, describe, it } from 'vitest';
import { print } from '@0no-co/graphql.web';

import { makeIntrospectionQuery, makeIntrospectSupportQuery, toSupportedFeatures } from '../query';

describe('makeIntrospectSupportQuery', () => {
  it('prints to introspection support query', () => {
    expect(print(makeIntrospectSupportQuery())).toMatchInlineSnapshot(`
      "query IntrospectSupportQuery {
        directive: __type(name: "__Directive") {
          fields {
            name
            args {
              name
            }
          }
        }
        field: __type(name: "__Field") {
          fields {
            name
            args {
              name
            }
          }
        }
        type: __type(name: "__Type") {
          fields {
            name
          }
        }
        inputValue: __type(name: "__InputValue") {
          fields {
            name
          }
        }
      }"
    `);
  });
});

describe('toSupportedFeatures', () => {
  it('outputs default with no features enabled', () => {
    expect(
      toSupportedFeatures({ type: null, inputValue: null, directive: null, field: null })
    ).toEqual({
      directiveIsRepeatable: false,
      specifiedByURL: false,
      inputValueDeprecation: false,
    });
  });

  it('detects `isRepeatable` and `includeDeprectaed` support on directives', () => {
    const input = {
      type: null, // stubbed
      inputValue: null, // stubbed
      field: null, // stubbed
      directive: {
        fields: [{ name: 'isRepeatable', args: [{ name: 'includeDeprecated' }] }],
      },
    };

    expect(toSupportedFeatures(input)).toMatchObject({
      directiveIsRepeatable: true,
      supportsDirectiveIsDeprecatedArgument: true,
    });
  });

  it('detects `includeDeprectaed` support on fields', () => {
    const input = {
      type: null, // stubbed
      inputValue: null, // stubbed
      directive: null, // stubbed
      field: {
        fields: [{ name: 'test', args: [{ name: 'includeDeprecated' }] }],
      },
    };

    expect(toSupportedFeatures(input)).toMatchObject({
      supportsFieldIsDeprecatedArgument: true,
    });
  });

  it('detects `specifiedByURL` support on scalars', () => {
    const input = {
      inputValue: null, // stubbed
      directive: null, // stubbed
      field: null, // stubbed
      type: {
        fields: [{ name: 'specifiedByURL' }],
      },
    };

    expect(toSupportedFeatures(input)).toMatchObject({
      specifiedByURL: true,
    });
  });

  it('detects `isDeprecated` support on input values', () => {
    const input = {
      type: null, // stubbed
      directive: null, // stubbed
      field: null, // stubbed
      inputValue: {
        fields: [{ name: 'isDeprecated' }],
      },
    };

    expect(toSupportedFeatures(input)).toMatchObject({
      inputValueDeprecation: true,
    });
  });
});

describe('makeIntrospectionQuery', () => {
  it('correctly outputs introspection query with all features enabled', () => {
    const support = {
      directiveIsRepeatable: true,
      specifiedByURL: true,
      inputValueDeprecation: true,
      supportsDirectiveIsDeprecatedArgument: true,
      supportsFieldIsDeprecatedArgument: true,
    };

    const output = print(makeIntrospectionQuery(support));

    expect(output).toMatch(/isRepeatable/);
    expect(output).toMatch(/specifiedByURL/);
    expect(output).toMatch(/inputFields\(includeDeprecated: true\)/);

    expect(output).toMatchInlineSnapshot(`
      "query IntrospectionQuery {
        __schema {
          queryType {
            name
          }
          mutationType {
            name
          }
          subscriptionType {
            name
          }
          types {
            ...FullType
          }
          directives {
            name
            description
            locations
            args(includeDeprecated: true) {
              ...InputValue
            }
            isRepeatable
          }
        }
      }

      fragment FullType on __Type {
        kind
        name
        description
        specifiedByURL
        fields(includeDeprecated: true) {
          name
          description
          isDeprecated
          deprecationReason
          args(includeDeprecated: true) {
            ...InputValue
          }
          type {
            ...TypeRef
          }
        }
        interfaces {
          ...TypeRef
        }
        possibleTypes {
          ...TypeRef
        }
        inputFields(includeDeprecated: true) {
          ...InputValue
        }
        enumValues(includeDeprecated: true) {
          name
          description
          isDeprecated
          deprecationReason
        }
      }

      fragment InputValue on __InputValue {
        name
        description
        defaultValue
        type {
          ...TypeRef
        }
        isDeprecated
        deprecationReason
      }

      fragment TypeRef on __Type {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                    ofType {
                      kind
                      name
                      ofType {
                        kind
                        name
                        ofType {
                          kind
                          name
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }"
    `);
  });

  it('correctly outputs introspection query with all features disabled', () => {
    const support = {
      directiveIsRepeatable: false,
      specifiedByURL: false,
      inputValueDeprecation: false,
      supportsDirectiveIsDeprecatedArgument: false,
      supportsFieldIsDeprecatedArgument: false,
    };

    const output = print(makeIntrospectionQuery(support));

    expect(output).not.toMatch(/isRepeatable/);
    expect(output).not.toMatch(/specifiedByURL/);
    expect(output).not.toMatch(/inputFields\(includeDeprecated: true\)/);

    expect(output).toMatchInlineSnapshot(`
      "query IntrospectionQuery {
        __schema {
          queryType {
            name
          }
          mutationType {
            name
          }
          subscriptionType {
            name
          }
          types {
            ...FullType
          }
          directives {
            name
            description
            locations
            args {
              ...InputValue
            }
          }
        }
      }

      fragment FullType on __Type {
        kind
        name
        description
        fields(includeDeprecated: true) {
          name
          description
          isDeprecated
          deprecationReason
          args {
            ...InputValue
          }
          type {
            ...TypeRef
          }
        }
        interfaces {
          ...TypeRef
        }
        possibleTypes {
          ...TypeRef
        }
        inputFields {
          ...InputValue
        }
        enumValues(includeDeprecated: true) {
          name
          description
          isDeprecated
          deprecationReason
        }
      }

      fragment InputValue on __InputValue {
        name
        description
        defaultValue
        type {
          ...TypeRef
        }
      }

      fragment TypeRef on __Type {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                    ofType {
                      kind
                      name
                      ofType {
                        kind
                        name
                        ofType {
                          kind
                          name
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }"
    `);
  });
});
