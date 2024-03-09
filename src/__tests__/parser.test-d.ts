import { describe, it, expectTypeOf } from 'vitest';
import type { Kind, OperationTypeNode, DocumentNode } from '@0no-co/graphql.web';
import type { Token, tokenize } from '../tokenizer';

import type {
  _match,
  parseDocument,
  takeValue,
  takeType,
  takeVarDefinition,
  takeVarDefinitions,
  takeSelectionSet,
  takeOperationDefinition,
  takeFragmentDefinition,
  takeDirective,
} from '../parser';

describe('takeValue', () => {
  it('parses variable inline values', () => {
    type expected = _match<
      {
        kind: Kind.OBJECT;
        fields: [
          {
            kind: Kind.OBJECT_FIELD;
            name: {
              kind: Kind.NAME;
              value: 'a';
            };
            value: {
              kind: Kind.OBJECT;
              fields: [
                {
                  kind: Kind.OBJECT_FIELD;
                  name: {
                    kind: Kind.NAME;
                    value: 'b';
                  };
                  value: {
                    kind: Kind.LIST;
                    values: [
                      {
                        kind: Kind.VARIABLE;
                        name: {
                          kind: Kind.NAME;
                          value: 'var';
                        };
                      },
                    ];
                  };
                },
              ];
            };
          },
        ];
      },
      []
    >;

    type actual = takeValue<tokenize<'{ a: { b: [ $var ] } }'>, false>;
    expectTypeOf<actual>().toEqualTypeOf<expected>();
  });
});

describe('takeVarDefinitions', () => {
  it('parses single variable definition', () => {
    type expected = _match<
      [
        {
          kind: Kind.VARIABLE_DEFINITION;
          variable: {
            kind: Kind.VARIABLE;
            name: {
              kind: Kind.NAME;
              value: 'x';
            };
          };
          type: {
            kind: Kind.NAMED_TYPE;
            name: {
              kind: Kind.NAME;
              value: 'A';
            };
          };
          defaultValue: undefined;
          directives: [];
        },
      ],
      []
    >;

    type actual = takeVarDefinitions<tokenize<'($x: A)'>>;
    expectTypeOf<actual>().toEqualTypeOf<expected>();
  });

  it('parses multiple variable definitions', () => {
    type expected = _match<
      [
        {
          kind: Kind.VARIABLE_DEFINITION;
          variable: {
            kind: Kind.VARIABLE;
            name: {
              kind: Kind.NAME;
              value: 'x';
            };
          };
          type: {
            kind: Kind.NAMED_TYPE;
            name: {
              kind: Kind.NAME;
              value: 'A';
            };
          };
          defaultValue: undefined;
          directives: [];
        },
        {
          kind: Kind.VARIABLE_DEFINITION;
          variable: {
            kind: Kind.VARIABLE;
            name: {
              kind: Kind.NAME;
              value: 'y';
            };
          };
          type: {
            kind: Kind.NAMED_TYPE;
            name: {
              kind: Kind.NAME;
              value: 'B';
            };
          };
          defaultValue: undefined;
          directives: [];
        },
      ],
      []
    >;

    type actual = takeVarDefinitions<tokenize<'($x: A, $y: B)'>>;
    expectTypeOf<actual>().toEqualTypeOf<expected>();
  });

  it('parses constant default values', () => {
    type expected = _match<
      {
        kind: Kind.VARIABLE_DEFINITION;
        variable: {
          kind: Kind.VARIABLE;
          name: {
            kind: Kind.NAME;
            value: 'x';
          };
        };
        type: {
          kind: Kind.NAMED_TYPE;
          name: {
            kind: Kind.NAME;
            value: 'Complex';
          };
        };
        defaultValue: {
          kind: Kind.STRING;
          value: string;
          block: boolean;
        };
        directives: [];
      },
      []
    >;

    expectTypeOf<takeVarDefinition<tokenize<'$x: Complex = "42"'>>>().toEqualTypeOf<expected>();
    expectTypeOf<takeVarDefinition<tokenize<'$x: Complex = $var'>>>().toEqualTypeOf<void>();
  });

  it('parses variable definition directives', () => {
    type expected = _match<
      {
        kind: Kind.VARIABLE_DEFINITION;
        variable: {
          kind: Kind.VARIABLE;
          name: {
            kind: Kind.NAME;
            value: 'x';
          };
        };
        type: {
          kind: Kind.NAMED_TYPE;
          name: {
            kind: Kind.NAME;
            value: 'Boolean';
          };
        };
        defaultValue: {
          kind: Kind.BOOLEAN;
          value: boolean;
        };
        directives: [
          {
            kind: Kind.DIRECTIVE;
            name: {
              kind: Kind.NAME;
              value: 'bar';
            };
            arguments: [];
          },
        ];
      },
      []
    >;

    type actual = takeVarDefinition<tokenize<'$x: Boolean = false @bar'>>;
    expectTypeOf<actual>().toEqualTypeOf<expected>();
  });
});

describe('takeSelectionSet', () => {
  it('does not accept fragment spread of "on"', () => {
    type expected = _match<
      {
        kind: Kind.SELECTION_SET;
        selections: [
          {
            kind: Kind.FRAGMENT_SPREAD;
            directives: [];
            name: {
              kind: Kind.NAME;
              value: 'On';
            };
          },
        ];
      },
      []
    >;

    expectTypeOf<takeSelectionSet<tokenize<'{ ...On }'>>>().toEqualTypeOf<expected>();
  });
});

describe('takeOperationDefinition', () => {
  it('parses anonymous mutation operations', () => {
    type expected = _match<
      {
        kind: Kind.OPERATION_DEFINITION;
        operation: OperationTypeNode.MUTATION;
        name: undefined;
        variableDefinitions: [];
        directives: [];
        selectionSet: {
          kind: Kind.SELECTION_SET;
          selections: [
            {
              kind: Kind.FIELD;
              name: {
                kind: Kind.NAME;
                value: 'mutationField';
              };
              arguments: [];
              alias: undefined;
              selectionSet: undefined;
              directives: [];
            },
          ];
        };
      },
      []
    >;

    expectTypeOf<
      takeOperationDefinition<tokenize<'mutation { mutationField }'>>
    >().toEqualTypeOf<expected>();
  });

  it('parses named mutation operations', () => {
    type expected = _match<
      {
        kind: Kind.OPERATION_DEFINITION;
        operation: OperationTypeNode.MUTATION;
        name: {
          kind: Kind.NAME;
          value: 'Foo';
        };
        variableDefinitions: [];
        directives: [];
        selectionSet: {
          kind: Kind.SELECTION_SET;
          selections: [
            {
              kind: Kind.FIELD;
              name: {
                kind: Kind.NAME;
                value: 'mutationField';
              };
              arguments: [];
              alias: undefined;
              selectionSet: undefined;
              directives: [];
            },
          ];
        };
      },
      []
    >;

    expectTypeOf<
      takeOperationDefinition<tokenize<'mutation Foo { mutationField }'>>
    >().toEqualTypeOf<expected>();
  });

  it('parses fragment definitions', () => {
    type expected = _match<
      {
        kind: Kind.FRAGMENT_DEFINITION;
        name: {
          kind: Kind.NAME;
          value: 'name';
        };
        typeCondition: {
          kind: Kind.NAMED_TYPE;
          name: {
            kind: Kind.NAME;
            value: 'Type';
          };
        };
        directives: [];
        selectionSet: {
          kind: Kind.SELECTION_SET;
          selections: [
            {
              kind: Kind.FIELD;
              name: {
                kind: Kind.NAME;
                value: 'field';
              };
              arguments: [];
              alias: undefined;
              selectionSet: undefined;
              directives: [];
            },
          ];
        };
      },
      []
    >;

    expectTypeOf<takeFragmentDefinition<tokenize<'fragment { test }'>>>().toEqualTypeOf<void>();
    expectTypeOf<
      takeFragmentDefinition<tokenize<'fragment name { test }'>>
    >().toEqualTypeOf<void>();
    expectTypeOf<takeFragmentDefinition<tokenize<'fragment name on name'>>>().toEqualTypeOf<void>();

    expectTypeOf<
      takeFragmentDefinition<tokenize<'fragment name on Type { field }'>>
    >().toEqualTypeOf<expected>();
  });
});

describe('takeField', () => {
  it('parses fields', () => {
    type expected = _match<
      {
        kind: Kind.SELECTION_SET;
        selections: [
          {
            kind: Kind.FIELD;
            arguments: [];
            alias: {
              kind: Kind.NAME;
              value: 'alias';
            };
            name: {
              kind: Kind.NAME;
              value: 'field';
            };
            directives: [
              {
                kind: Kind.DIRECTIVE;
                name: {
                  kind: Kind.NAME;
                  value: 'test';
                };
                arguments: [
                  {
                    kind: Kind.ARGUMENT;
                    name: {
                      kind: Kind.NAME;
                      value: 'arg';
                    };
                    value: {
                      kind: Kind.NULL;
                    };
                  },
                ];
              },
            ];
            selectionSet: {
              kind: Kind.SELECTION_SET;
              selections: [
                {
                  kind: Kind.FIELD;
                  name: {
                    kind: Kind.NAME;
                    value: 'child';
                  };
                  arguments: [];
                  alias: undefined;
                  selectionSet: undefined;
                  directives: [];
                },
              ];
            };
          },
        ];
      },
      []
    >;

    expectTypeOf<takeSelectionSet<tokenize<'{ alias: field( }'>>>().toEqualTypeOf<void>();

    expectTypeOf<
      takeSelectionSet<tokenize<'{ alias: field @test(arg: null) { child } }'>>
    >().toEqualTypeOf<expected>();
  });

  it('parses arguments', () => {
    type expected = _match<
      {
        kind: Kind.SELECTION_SET;
        selections: [
          {
            kind: Kind.FIELD;
            alias: undefined;
            name: {
              kind: Kind.NAME;
              value: 'field';
            };
            arguments: [
              {
                kind: Kind.ARGUMENT;
                name: {
                  kind: Kind.NAME;
                  value: 'a';
                };
                value: {
                  kind: Kind.NULL;
                };
              },
              {
                kind: Kind.ARGUMENT;
                name: {
                  kind: Kind.NAME;
                  value: 'b';
                };
                value: {
                  kind: Kind.NULL;
                };
              },
            ];
            directives: [];
            selectionSet: undefined;
          },
        ];
      },
      []
    >;

    expectTypeOf<takeSelectionSet<tokenize<'{ field( }'>>>().toEqualTypeOf<void>();
    expectTypeOf<takeSelectionSet<tokenize<'{ field(name) }'>>>().toEqualTypeOf<void>();
    expectTypeOf<takeSelectionSet<tokenize<'{ field(name:) }'>>>().toEqualTypeOf<void>();
    expectTypeOf<takeSelectionSet<tokenize<'{ field(name: null }'>>>().toEqualTypeOf<void>();

    expectTypeOf<
      takeSelectionSet<tokenize<'{ field(a: null, b: null) }'>>
    >().toEqualTypeOf<expected>();
  });
});

describe('takeDirective', () => {
  it('parses directives', () => {
    type expected = _match<
      {
        kind: Kind.DIRECTIVE;
        name: {
          kind: Kind.NAME;
          value: 'test';
        };
        arguments: [
          {
            kind: Kind.ARGUMENT;
            name: {
              kind: Kind.NAME;
              value: 'name';
            };
            value: {
              kind: Kind.NULL;
            };
          },
        ];
      },
      []
    >;

    expectTypeOf<takeDirective<tokenize<'@test(name: null)'>, false>>().toEqualTypeOf<expected>();
  });
});

describe('takeFragmentSpread', () => {
  it('parses inline fragments', () => {
    type expected = _match<
      {
        kind: Kind.SELECTION_SET;
        selections: [
          {
            kind: Kind.INLINE_FRAGMENT;
            typeCondition: {
              kind: Kind.NAMED_TYPE;
              name: {
                kind: Kind.NAME;
                value: 'Test';
              };
            };
            directives: [];
            selectionSet: {
              kind: Kind.SELECTION_SET;
              selections: [
                {
                  kind: Kind.FIELD;
                  name: {
                    kind: Kind.NAME;
                    value: 'field';
                  };
                  arguments: [];
                  alias: undefined;
                  selectionSet: undefined;
                  directives: [];
                },
              ];
            };
          },
        ];
      },
      []
    >;

    expectTypeOf<takeSelectionSet<tokenize<'{ ... on Test }'>>>().toEqualTypeOf<void>();
    expectTypeOf<takeSelectionSet<tokenize<'{ ... }'>>>().toEqualTypeOf<void>();
    expectTypeOf<
      takeSelectionSet<tokenize<'{ ... on Test { field } }'>>
    >().toEqualTypeOf<expected>();
  });

  it('parses conditionless inline fragments', () => {
    type expected = _match<
      {
        kind: Kind.SELECTION_SET;
        selections: [
          {
            kind: Kind.INLINE_FRAGMENT;
            typeCondition: undefined;
            directives: [];
            selectionSet: {
              kind: Kind.SELECTION_SET;
              selections: [
                {
                  kind: Kind.FIELD;
                  name: {
                    kind: Kind.NAME;
                    value: 'field';
                  };
                  arguments: [];
                  alias: undefined;
                  selectionSet: undefined;
                  directives: [];
                },
              ];
            };
          },
        ];
      },
      []
    >;

    expectTypeOf<takeSelectionSet<tokenize<'{ ... on Test }'>>>().toEqualTypeOf<void>();
    expectTypeOf<takeSelectionSet<tokenize<'{ ... }'>>>().toEqualTypeOf<void>();

    expectTypeOf<takeSelectionSet<tokenize<'{ ... { field } }'>>>().toEqualTypeOf<expected>();
  });
});

describe('takeValue', () => {
  it('parses basic values', () => {
    expectTypeOf<takeValue<tokenize<''>, false>>().toEqualTypeOf<void>();
    expectTypeOf<takeValue<tokenize<':'>, false>>().toEqualTypeOf<void>();

    expectTypeOf<takeValue<tokenize<'null'>, false>>().toEqualTypeOf<
      _match<{ kind: Kind.NULL }, []>
    >();
    expectTypeOf<takeValue<tokenize<'true'>, false>>().toEqualTypeOf<
      _match<{ kind: Kind.BOOLEAN; value: boolean }, []>
    >();
    expectTypeOf<takeValue<tokenize<'false'>, false>>().toEqualTypeOf<
      _match<{ kind: Kind.BOOLEAN; value: boolean }, []>
    >();
    expectTypeOf<takeValue<tokenize<'VAL'>, false>>().toEqualTypeOf<
      _match<{ kind: Kind.ENUM; value: 'VAL' }, []>
    >();
  });

  it('parses list values', () => {
    type expected = _match<
      {
        kind: Kind.LIST;
        values: [
          {
            kind: Kind.INT;
            value: string;
          },
          {
            kind: Kind.STRING;
            value: string;
            block: boolean;
          },
        ];
      },
      []
    >;

    type actual = takeValue<tokenize<'[123 "abc"]'>, false>;
    expectTypeOf<actual>().toEqualTypeOf<expected>();
  });

  it('parses integers', () => {
    type expected = _match<{ kind: Kind.INT; value: string }, []>;

    expectTypeOf<takeValue<tokenize<'-'>, false>>().toEqualTypeOf<void>();

    expectTypeOf<takeValue<tokenize<'12'>, false>>().toEqualTypeOf<expected>();
    expectTypeOf<takeValue<tokenize<'-12'>, false>>().toEqualTypeOf<expected>();
  });

  it('parses floats', () => {
    type expected = _match<{ kind: Kind.FLOAT; value: string }, []>;

    expectTypeOf<takeValue<tokenize<'-.0e'>, false>>().toEqualTypeOf<void>();

    expectTypeOf<takeValue<tokenize<'12e2'>, false>>().toEqualTypeOf<expected>();
    expectTypeOf<takeValue<tokenize<'0.2E3'>, false>>().toEqualTypeOf<expected>();
    expectTypeOf<takeValue<tokenize<'-1.2e+3'>, false>>().toEqualTypeOf<expected>();
  });

  it('parses strings', () => {
    type expected = { kind: Kind.STRING; value: string; block: boolean };

    expectTypeOf<takeValue<tokenize<'""'>, false>>().toEqualTypeOf<_match<expected, []>>();
    expectTypeOf<takeValue<tokenize<'"\\t\\t"'>, false>>().toEqualTypeOf<_match<expected, []>>();
    expectTypeOf<takeValue<tokenize<'" \\" "'>, false>>().toEqualTypeOf<_match<expected, []>>();
    expectTypeOf<takeValue<tokenize<'"x" ""'>, false>>().toEqualTypeOf<
      _match<expected, [Token.String]>
    >();
    expectTypeOf<takeValue<tokenize<'"" ""'>, false>>().toEqualTypeOf<
      _match<expected, [Token.String]>
    >();
    expectTypeOf<takeValue<tokenize<'" \\" " ""'>, false>>().toEqualTypeOf<
      _match<expected, [Token.String]>
    >();
  });

  it('parses block strings', () => {
    type expected = _match<{ kind: Kind.STRING; value: string; block: boolean }, []>;

    const x = `""" 
      \\"""
    """` as const;

    expectTypeOf<takeValue<tokenize<'""""""'>, false>>().toEqualTypeOf<expected>();
    expectTypeOf<takeValue<tokenize<'"""\n"""'>, false>>().toEqualTypeOf<expected>();
    expectTypeOf<takeValue<tokenize<'""" \\""" """'>, false>>().toEqualTypeOf<expected>();
    expectTypeOf<takeValue<tokenize<typeof x>, false>>().toEqualTypeOf<expected>();
  });

  it('parses objects', () => {
    expectTypeOf<takeValue<tokenize<'{}'>, false>>().toEqualTypeOf<
      _match<{ kind: Kind.OBJECT; fields: [] }, []>
    >();

    expectTypeOf<takeValue<tokenize<'{name}'>, false>>().toEqualTypeOf<void>();
    expectTypeOf<takeValue<tokenize<'{name:}'>, false>>().toEqualTypeOf<void>();
    expectTypeOf<takeValue<tokenize<'{name:null'>, false>>().toEqualTypeOf<void>();

    expectTypeOf<takeValue<tokenize<'{name:null}'>, false>>().toEqualTypeOf<
      _match<
        {
          kind: Kind.OBJECT;
          fields: [
            {
              kind: Kind.OBJECT_FIELD;
              name: {
                kind: Kind.NAME;
                value: 'name';
              };
              value: {
                kind: Kind.NULL;
              };
            },
          ];
        },
        []
      >
    >();

    expectTypeOf<takeValue<tokenize<'{a:"a"}'>, false>>().toEqualTypeOf<
      _match<
        {
          kind: Kind.OBJECT;
          fields: [
            {
              kind: Kind.OBJECT_FIELD;
              name: {
                kind: Kind.NAME;
                value: 'a';
              };
              value: {
                kind: Kind.STRING;
                value: string;
                block: boolean;
              };
            },
          ];
        },
        []
      >
    >();

    expectTypeOf<takeValue<tokenize<'{a:"a"\nb: """\n\\"""\n"""}'>, false>>().toEqualTypeOf<
      _match<
        {
          kind: Kind.OBJECT;
          fields: [
            {
              kind: Kind.OBJECT_FIELD;
              name: {
                kind: Kind.NAME;
                value: 'a';
              };
              value: {
                kind: Kind.STRING;
                value: string;
                block: boolean;
              };
            },
            {
              kind: Kind.OBJECT_FIELD;
              name: {
                kind: Kind.NAME;
                value: 'b';
              };
              value: {
                kind: Kind.STRING;
                value: string;
                block: boolean;
              };
            },
          ];
        },
        []
      >
    >();
  });

  it('parses lists', () => {
    expectTypeOf<takeValue<tokenize<'[]'>, false>>().toEqualTypeOf<
      _match<{ kind: Kind.LIST; values: [] }, []>
    >();

    expectTypeOf<takeValue<tokenize<'['>, false>>().toEqualTypeOf<void>();
    expectTypeOf<takeValue<tokenize<'[null'>, false>>().toEqualTypeOf<void>();

    expectTypeOf<takeValue<tokenize<'[null]'>, false>>().toEqualTypeOf<
      _match<
        {
          kind: Kind.LIST;
          values: [{ kind: Kind.NULL }];
        },
        []
      >
    >();
  });

  it('parses variables', () => {
    expectTypeOf<takeValue<tokenize<'$var'>, false>>().toEqualTypeOf<
      _match<
        {
          kind: Kind.VARIABLE;
          name: {
            kind: Kind.NAME;
            value: 'var';
          };
        },
        []
      >
    >();

    expectTypeOf<takeValue<tokenize<'$var'>, true>>().toEqualTypeOf<void>();
  });
});

describe('takeType', () => {
  it('parses basic types', () => {
    expectTypeOf<takeType<tokenize<''>>>().toEqualTypeOf<void>();
    expectTypeOf<takeType<tokenize<'['>>>().toEqualTypeOf<void>();
    expectTypeOf<takeType<tokenize<'!'>>>().toEqualTypeOf<void>();

    expectTypeOf<takeType<tokenize<'Type'>>>().toEqualTypeOf<
      _match<
        {
          kind: Kind.NAMED_TYPE;
          name: {
            kind: Kind.NAME;
            value: 'Type';
          };
        },
        []
      >
    >();

    expectTypeOf<takeType<tokenize<'Type!'>>>().toEqualTypeOf<
      _match<
        {
          kind: Kind.NON_NULL_TYPE;
          type: {
            kind: Kind.NAMED_TYPE;
            name: {
              kind: Kind.NAME;
              value: 'Type';
            };
          };
        },
        []
      >
    >();

    expectTypeOf<takeType<tokenize<'[Type!]'>>>().toEqualTypeOf<
      _match<
        {
          kind: Kind.LIST_TYPE;
          type: {
            kind: Kind.NON_NULL_TYPE;
            type: {
              kind: Kind.NAMED_TYPE;
              name: {
                kind: Kind.NAME;
                value: 'Type';
              };
            };
          };
        },
        []
      >
    >();

    expectTypeOf<takeType<tokenize<'[Type!]!'>>>().toEqualTypeOf<
      _match<
        {
          kind: Kind.NON_NULL_TYPE;
          type: {
            kind: Kind.LIST_TYPE;
            type: {
              kind: Kind.NON_NULL_TYPE;
              type: {
                kind: Kind.NAMED_TYPE;
                name: {
                  kind: Kind.NAME;
                  value: 'Type';
                };
              };
            };
          };
        },
        []
      >
    >();
  });
});

describe('parseDocument', () => {
  it('should not parse invalid documents', () => {
    expectTypeOf<parseDocument<'INVALID'>>().toBeNever();
  });

  it('should parse initially valid definitions', () => {
    expectTypeOf<parseDocument<'{ test } INVALID'>>().not.toBeNever();
  });

  it('parses kitchen sink query', () => {
    type kitchensinkQuery = typeof import('./fixtures/kitchensinkQuery').kitchensinkQuery;
    type kitchensinkDocument = import('./fixtures/kitchensinkQuery').kitchensinkDocument;
    type actual = parseDocument<kitchensinkQuery>;

    expectTypeOf<actual>().toEqualTypeOf<kitchensinkDocument>();
    expectTypeOf<actual>().toMatchTypeOf<kitchensinkDocument>();
    expectTypeOf<actual>().toMatchTypeOf<DocumentNode>();
  });
});
