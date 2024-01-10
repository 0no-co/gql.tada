import { describe, it, expectTypeOf } from 'vitest';
import type { Kind, OperationTypeNode, DocumentNode } from '@0no-co/graphql.web';

import type {
  parseDocument,
  takeValue,
  takeType,
  takeVarDefinition,
  takeVarDefinitions,
  takeSelectionSet,
  takeOperationDefinition,
  takeFragmentDefinition,
  takeFragmentSpread,
  takeDirective,
  takeField,
} from '../parser';

describe('takeValue', () => {
  it('parses variable inline values', () => {
    type expected = [
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
      '',
    ];

    expectTypeOf<takeValue<'{ a: { b: [ $var ] } }', false>>().toEqualTypeOf<expected>();
  });
});

describe('takeVarDefinitions', () => {
  it('parses single variable definition', () => {
    type expected = [
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
      '',
    ];

    expectTypeOf<takeVarDefinitions<'($x: A)'>>().toEqualTypeOf<expected>();
  });

  it('parses multiple variable definitions', () => {
    type expected = [
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
      '',
    ];

    expectTypeOf<takeVarDefinitions<'($x: A, $y: B)'>>().toEqualTypeOf<expected>();
  });

  it('parses constant default values', () => {
    type expected = [
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
          block: false;
        };
        directives: [];
      },
      '',
    ];

    expectTypeOf<takeVarDefinition<'$x: Complex = "42"'>>().toEqualTypeOf<expected>();
    expectTypeOf<takeVarDefinition<'$x: Complex = $var'>>().toEqualTypeOf<void>();
  });

  it('parses variable definition directives', () => {
    type expected = [
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
      '',
    ];

    expectTypeOf<takeVarDefinition<'$x: Boolean = false @bar'>>().toEqualTypeOf<expected>();
  });
});

describe('takeSelectionSet', () => {
  it('does not accept fragment spread of "on"', () => {
    type expected = [
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
      '',
    ];

    expectTypeOf<takeSelectionSet<'{ ...On }'>>().toEqualTypeOf<expected>();
    expectTypeOf<takeSelectionSet<'{ ...on }'>>().toEqualTypeOf<void>();
  });
});

describe('takeOperationDefinition', () => {
  it('parses anonymous mutation operations', () => {
    type expected = [
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
      '',
    ];

    expectTypeOf<takeOperationDefinition<'mutation { mutationField }'>>().toEqualTypeOf<expected>();
  });

  it('parses named mutation operations', () => {
    type expected = [
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
      '',
    ];

    expectTypeOf<
      takeOperationDefinition<'mutation Foo { mutationField }'>
    >().toEqualTypeOf<expected>();
  });

  it('parses fragment definitions', () => {
    type expected = [
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
      '',
    ];

    expectTypeOf<takeFragmentDefinition<'fragment { test }'>>().toEqualTypeOf<void>();
    expectTypeOf<takeFragmentDefinition<'fragment name { test }'>>().toEqualTypeOf<void>();
    expectTypeOf<takeFragmentDefinition<'fragment name on name'>>().toEqualTypeOf<void>();

    expectTypeOf<
      takeFragmentDefinition<'fragment name on Type { field }'>
    >().toEqualTypeOf<expected>();
  });
});

describe('takeField', () => {
  it('parses fields', () => {
    type expected = [
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
      '',
    ];

    expectTypeOf<takeField<'field: '>>().toEqualTypeOf<void>();
    expectTypeOf<takeField<'alias: field()'>>().toEqualTypeOf<void>();

    expectTypeOf<takeField<'alias: field @test(arg: null) { child }'>>().toEqualTypeOf<expected>();
  });

  it('parses arguments', () => {
    type expected = [
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
      '',
    ];

    expectTypeOf<takeField<'field()'>>().toEqualTypeOf<void>();
    expectTypeOf<takeField<'field(name)'>>().toEqualTypeOf<void>();
    expectTypeOf<takeField<'field(name:)'>>().toEqualTypeOf<void>();
    expectTypeOf<takeField<'field(name: null'>>().toEqualTypeOf<void>();

    expectTypeOf<takeField<'field(a: null, b: null)'>>().toEqualTypeOf<expected>();
  });
});

describe('takeDirective', () => {
  it('parses directives', () => {
    type expected = [
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
      '',
    ];

    expectTypeOf<takeDirective<'@', false>>().toEqualTypeOf<void>();
    expectTypeOf<takeDirective<'@(test: null)', false>>().toEqualTypeOf<void>();

    expectTypeOf<takeDirective<'@test(name: null)', false>>().toEqualTypeOf<expected>();
  });
});

describe('takeFragmentSpread', () => {
  it('parses inline fragments', () => {
    type expected = [
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
      '',
    ];

    expectTypeOf<takeFragmentSpread<'... on Test'>>().toEqualTypeOf<void>();
    expectTypeOf<takeFragmentSpread<'...'>>().toEqualTypeOf<void>();
    expectTypeOf<takeFragmentSpread<'... on Test { field }'>>().toEqualTypeOf<expected>();
  });

  it('parses conditionless inline fragments', () => {
    type expected = [
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
      '',
    ];

    expectTypeOf<takeFragmentSpread<'... on Test'>>().toEqualTypeOf<void>();
    expectTypeOf<takeFragmentSpread<'...'>>().toEqualTypeOf<void>();

    expectTypeOf<takeFragmentSpread<'... { field }'>>().toEqualTypeOf<expected>();
  });
});

describe('takeValue', () => {
  it('parses basic values', () => {
    expectTypeOf<takeValue<'', false>>().toEqualTypeOf<void>();
    expectTypeOf<takeValue<'$', false>>().toEqualTypeOf<void>();
    expectTypeOf<takeValue<':', false>>().toEqualTypeOf<void>();

    expectTypeOf<takeValue<'null', false>>().toEqualTypeOf<[{ kind: Kind.NULL }, '']>();
    expectTypeOf<takeValue<'true', false>>().toEqualTypeOf<
      [{ kind: Kind.BOOLEAN; value: boolean }, '']
    >();
    expectTypeOf<takeValue<'false', false>>().toEqualTypeOf<
      [{ kind: Kind.BOOLEAN; value: boolean }, '']
    >();
    expectTypeOf<takeValue<'VAL', false>>().toEqualTypeOf<
      [{ kind: Kind.ENUM; value: 'VAL' }, '']
    >();
  });

  it('parses list values', () => {
    type expected = [
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
            block: false;
          },
        ];
      },
      '',
    ];

    expectTypeOf<takeValue<'[123 "abc"]', false>>().toEqualTypeOf<expected>();
  });

  it('parses integers', () => {
    type expected = [{ kind: Kind.INT; value: string }, ''];

    expectTypeOf<takeValue<'-', false>>().toEqualTypeOf<void>();

    expectTypeOf<takeValue<'12', false>>().toEqualTypeOf<expected>();
    expectTypeOf<takeValue<'-12', false>>().toEqualTypeOf<expected>();
  });

  it('parses floats', () => {
    type expected = [{ kind: Kind.FLOAT; value: string }, ''];

    expectTypeOf<takeValue<'-.0e', false>>().toEqualTypeOf<void>();

    expectTypeOf<takeValue<'12e2', false>>().toEqualTypeOf<expected>();
    expectTypeOf<takeValue<'0.2E3', false>>().toEqualTypeOf<expected>();
    expectTypeOf<takeValue<'-1.2e+3', false>>().toEqualTypeOf<expected>();
  });

  it('parses strings', () => {
    type expected = { kind: Kind.STRING; value: string; block: false };

    expectTypeOf<takeValue<'""', false>>().toEqualTypeOf<[expected, '']>();
    expectTypeOf<takeValue<'"\\t\\t"', false>>().toEqualTypeOf<[expected, '']>();
    expectTypeOf<takeValue<'" \\" "', false>>().toEqualTypeOf<[expected, '']>();
    expectTypeOf<takeValue<'"x" "x"', false>>().toEqualTypeOf<[expected, ' "x"']>();
    expectTypeOf<takeValue<'"" ""', false>>().toEqualTypeOf<[expected, ' ""']>();
    expectTypeOf<takeValue<'" \\" " ""', false>>().toEqualTypeOf<[expected, ' ""']>();
  });

  it('parses block strings', () => {
    type expected = [{ kind: Kind.STRING; value: string; block: true }, ''];

    const x = `""" 
      \\"""
    """` as const;

    expectTypeOf<takeValue<'""""""', false>>().toEqualTypeOf<expected>();
    expectTypeOf<takeValue<'"""\n"""', false>>().toEqualTypeOf<expected>();
    expectTypeOf<takeValue<'""" \\""" """', false>>().toEqualTypeOf<expected>();
    expectTypeOf<takeValue<typeof x, false>>().toEqualTypeOf<expected>();
  });

  it('parses objects', () => {
    expectTypeOf<takeValue<'{}', false>>().toEqualTypeOf<[{ kind: Kind.OBJECT; fields: [] }, '']>();

    expectTypeOf<takeValue<'{name}', false>>().toEqualTypeOf<void>();
    expectTypeOf<takeValue<'{name:}', false>>().toEqualTypeOf<void>();
    expectTypeOf<takeValue<'{name:null', false>>().toEqualTypeOf<void>();

    expectTypeOf<takeValue<'{name:null}', false>>().toEqualTypeOf<
      [
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
        '',
      ]
    >();

    expectTypeOf<takeValue<'{a:"a"}', false>>().toEqualTypeOf<
      [
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
                block: false;
              };
            },
          ];
        },
        '',
      ]
    >();

    expectTypeOf<takeValue<'{a:"a"\nb: """\n\\"""\n"""}', false>>().toEqualTypeOf<
      [
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
                block: false;
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
                block: true;
              };
            },
          ];
        },
        '',
      ]
    >();
  });

  it('parses lists', () => {
    expectTypeOf<takeValue<'[]', false>>().toEqualTypeOf<[{ kind: Kind.LIST; values: [] }, '']>();

    expectTypeOf<takeValue<'[', false>>().toEqualTypeOf<void>();
    expectTypeOf<takeValue<'[null', false>>().toEqualTypeOf<void>();

    expectTypeOf<takeValue<'[null]', false>>().toEqualTypeOf<
      [
        {
          kind: Kind.LIST;
          values: [{ kind: Kind.NULL }];
        },
        '',
      ]
    >();
  });

  it('parses variables', () => {
    expectTypeOf<takeValue<'$var', false>>().toEqualTypeOf<
      [
        {
          kind: Kind.VARIABLE;
          name: {
            kind: Kind.NAME;
            value: 'var';
          };
        },
        '',
      ]
    >();

    expectTypeOf<takeValue<'$var', true>>().toEqualTypeOf<void>();
  });
});

describe('takeType', () => {
  it('parses basic types', () => {
    expectTypeOf<takeType<''>>().toEqualTypeOf<void>();
    expectTypeOf<takeType<'['>>().toEqualTypeOf<void>();
    expectTypeOf<takeType<'!'>>().toEqualTypeOf<void>();

    expectTypeOf<takeType<'Type'>>().toEqualTypeOf<
      [
        {
          kind: Kind.NAMED_TYPE;
          name: {
            kind: Kind.NAME;
            value: 'Type';
          };
        },
        '',
      ]
    >();

    expectTypeOf<takeType<'Type!'>>().toEqualTypeOf<
      [
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
        '',
      ]
    >();

    expectTypeOf<takeType<'[Type!]'>>().toEqualTypeOf<
      [
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
        '',
      ]
    >();

    expectTypeOf<takeType<'[Type!]!'>>().toEqualTypeOf<
      [
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
        '',
      ]
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
