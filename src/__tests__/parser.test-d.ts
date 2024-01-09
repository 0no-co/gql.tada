import { describe, it, expectTypeOf } from 'vitest';
import { Kind, OperationTypeNode, DocumentNode } from '@0no-co/graphql.web';

import {
  Document,
  TakeValue,
  TakeType,
  TakeVarDefinition,
  TakeVarDefinitions,
  TakeSelectionSetContinue,
  TakeOperationDefinition,
  TakeFragmentDefinition,
  TakeFragmentSpread,
  TakeDirective,
  TakeField,
} from '../parser';

describe('TakeValue', () => {
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

    expectTypeOf<TakeValue<'{ a: { b: [ $var ] } }', false>>().toEqualTypeOf<expected>();
  });
});

describe('TakeVarDefinitions', () => {
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

    expectTypeOf<TakeVarDefinitions<'($x: A)'>>().toEqualTypeOf<expected>();
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

    expectTypeOf<TakeVarDefinitions<'($x: A, $y: B)'>>().toEqualTypeOf<expected>();
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

    expectTypeOf<TakeVarDefinition<'$x: Complex = "42"'>>().toEqualTypeOf<expected>();
    expectTypeOf<TakeVarDefinition<'$x: Complex = $var'>>().toEqualTypeOf<void>();
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

    expectTypeOf<TakeVarDefinition<'$x: Boolean = false @bar'>>().toEqualTypeOf<expected>();
  });
});

describe('TakeSelectionSetContinue', () => {
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

    expectTypeOf<TakeSelectionSetContinue<'{ ...On }'>>().toEqualTypeOf<expected>();
    expectTypeOf<TakeSelectionSetContinue<'{ ...on }'>>().toEqualTypeOf<void>();
  });
});

describe('TakeOperationDefinition', () => {
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

    expectTypeOf<TakeOperationDefinition<'mutation { mutationField }'>>().toEqualTypeOf<expected>();
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
      TakeOperationDefinition<'mutation Foo { mutationField }'>
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

    expectTypeOf<TakeFragmentDefinition<'fragment { test }'>>().toEqualTypeOf<void>();
    expectTypeOf<TakeFragmentDefinition<'fragment name { test }'>>().toEqualTypeOf<void>();
    expectTypeOf<TakeFragmentDefinition<'fragment name on name'>>().toEqualTypeOf<void>();

    expectTypeOf<
      TakeFragmentDefinition<'fragment name on Type { field }'>
    >().toEqualTypeOf<expected>();
  });
});

describe('TakeField', () => {
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

    expectTypeOf<TakeField<'field: '>>().toEqualTypeOf<void>();
    expectTypeOf<TakeField<'alias: field()'>>().toEqualTypeOf<void>();

    expectTypeOf<TakeField<'alias: field @test(arg: null) { child }'>>().toEqualTypeOf<expected>();
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

    expectTypeOf<TakeField<'field()'>>().toEqualTypeOf<void>();
    expectTypeOf<TakeField<'field(name)'>>().toEqualTypeOf<void>();
    expectTypeOf<TakeField<'field(name:)'>>().toEqualTypeOf<void>();
    expectTypeOf<TakeField<'field(name: null'>>().toEqualTypeOf<void>();

    expectTypeOf<TakeField<'field(a: null, b: null)'>>().toEqualTypeOf<expected>();
  });
});

describe('TakeDirective', () => {
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

    expectTypeOf<TakeDirective<'@', false>>().toEqualTypeOf<void>();
    expectTypeOf<TakeDirective<'@(test: null)', false>>().toEqualTypeOf<void>();

    expectTypeOf<TakeDirective<'@test(name: null)', false>>().toEqualTypeOf<expected>();
  });
});

describe('TakeFragmentSpread', () => {
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

    expectTypeOf<TakeFragmentSpread<'... on Test'>>().toEqualTypeOf<void>();
    expectTypeOf<TakeFragmentSpread<'...'>>().toEqualTypeOf<void>();

    expectTypeOf<TakeFragmentSpread<'... on Test { field }'>>().toEqualTypeOf<expected>();
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

    expectTypeOf<TakeFragmentSpread<'... on Test'>>().toEqualTypeOf<void>();
    expectTypeOf<TakeFragmentSpread<'...'>>().toEqualTypeOf<void>();

    expectTypeOf<TakeFragmentSpread<'... { field }'>>().toEqualTypeOf<expected>();
  });
});

describe('TakeValue', () => {
  it('parses basic values', () => {
    expectTypeOf<TakeValue<'', false>>().toEqualTypeOf<void>();
    expectTypeOf<TakeValue<'$', false>>().toEqualTypeOf<void>();
    expectTypeOf<TakeValue<':', false>>().toEqualTypeOf<void>();

    expectTypeOf<TakeValue<'null', false>>().toEqualTypeOf<[{ kind: Kind.NULL }, '']>();
    expectTypeOf<TakeValue<'true', false>>().toEqualTypeOf<
      [{ kind: Kind.BOOLEAN; value: boolean }, '']
    >();
    expectTypeOf<TakeValue<'false', false>>().toEqualTypeOf<
      [{ kind: Kind.BOOLEAN; value: boolean }, '']
    >();
    expectTypeOf<TakeValue<'VAL', false>>().toEqualTypeOf<
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

    expectTypeOf<TakeValue<'[123 "abc"]', false>>().toEqualTypeOf<expected>();
  });

  it('parses integers', () => {
    type expected = [{ kind: Kind.INT; value: string }, ''];

    expectTypeOf<TakeValue<'-', false>>().toEqualTypeOf<void>();

    expectTypeOf<TakeValue<'12', false>>().toEqualTypeOf<expected>();
    expectTypeOf<TakeValue<'-12', false>>().toEqualTypeOf<expected>();
  });

  it('parses floats', () => {
    type expected = [{ kind: Kind.FLOAT; value: string }, ''];

    expectTypeOf<TakeValue<'-.0e', false>>().toEqualTypeOf<void>();

    expectTypeOf<TakeValue<'12e2', false>>().toEqualTypeOf<expected>();
    expectTypeOf<TakeValue<'0.2E3', false>>().toEqualTypeOf<expected>();
    expectTypeOf<TakeValue<'-1.2e+3', false>>().toEqualTypeOf<expected>();
  });

  it('parses strings', () => {
    type expected = { kind: Kind.STRING; value: string; block: false };

    expectTypeOf<TakeValue<'""', false>>().toEqualTypeOf<[expected, '']>();
    expectTypeOf<TakeValue<'"\\t\\t"', false>>().toEqualTypeOf<[expected, '']>();
    expectTypeOf<TakeValue<'" \\" "', false>>().toEqualTypeOf<[expected, '']>();
    expectTypeOf<TakeValue<'"x" "x"', false>>().toEqualTypeOf<[expected, ' "x"']>();
    expectTypeOf<TakeValue<'"" ""', false>>().toEqualTypeOf<[expected, ' ""']>();
    expectTypeOf<TakeValue<'" \\" " ""', false>>().toEqualTypeOf<[expected, ' ""']>();
  });

  it('parses block strings', () => {
    type expected = [{ kind: Kind.STRING; value: string; block: true }, ''];

    const x = `""" 
      \\"""
    """` as const;

    expectTypeOf<TakeValue<'""""""', false>>().toEqualTypeOf<expected>();
    expectTypeOf<TakeValue<'"""\n"""', false>>().toEqualTypeOf<expected>();
    expectTypeOf<TakeValue<'""" \\""" """', false>>().toEqualTypeOf<expected>();
    expectTypeOf<TakeValue<typeof x, false>>().toEqualTypeOf<expected>();
  });

  it('parses objects', () => {
    expectTypeOf<TakeValue<'{}', false>>().toEqualTypeOf<[{ kind: Kind.OBJECT; fields: [] }, '']>();

    expectTypeOf<TakeValue<'{name}', false>>().toEqualTypeOf<void>();
    expectTypeOf<TakeValue<'{name:}', false>>().toEqualTypeOf<void>();
    expectTypeOf<TakeValue<'{name:null', false>>().toEqualTypeOf<void>();

    expectTypeOf<TakeValue<'{name:null}', false>>().toEqualTypeOf<
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

    expectTypeOf<TakeValue<'{a:"a"}', false>>().toEqualTypeOf<
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

    expectTypeOf<TakeValue<'{a:"a"\nb: """\n\\"""\n"""}', false>>().toEqualTypeOf<
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
    expectTypeOf<TakeValue<'[]', false>>().toEqualTypeOf<[{ kind: Kind.LIST; values: [] }, '']>();

    expectTypeOf<TakeValue<'[', false>>().toEqualTypeOf<void>();
    expectTypeOf<TakeValue<'[null', false>>().toEqualTypeOf<void>();

    expectTypeOf<TakeValue<'[null]', false>>().toEqualTypeOf<
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
    expectTypeOf<TakeValue<'$var', false>>().toEqualTypeOf<
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

    expectTypeOf<TakeValue<'$var', true>>().toEqualTypeOf<void>();
  });
});

describe('TakeType', () => {
  it('parses basic types', () => {
    expectTypeOf<TakeType<''>>().toEqualTypeOf<void>();
    expectTypeOf<TakeType<'['>>().toEqualTypeOf<void>();
    expectTypeOf<TakeType<'!'>>().toEqualTypeOf<void>();

    expectTypeOf<TakeType<'Type'>>().toEqualTypeOf<
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

    expectTypeOf<TakeType<'Type!'>>().toEqualTypeOf<
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

    expectTypeOf<TakeType<'[Type!]'>>().toEqualTypeOf<
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

    expectTypeOf<TakeType<'[Type!]!'>>().toEqualTypeOf<
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

describe('Document', () => {
  it('parses kitchen sink query', () => {
    type kitchensinkQuery = typeof import('./fixtures/kitchensinkQuery').kitchensinkQuery;
    type kitchensinkDocument = import('./fixtures/kitchensinkQuery').kitchensinkDocument;

    expectTypeOf<Document<kitchensinkQuery>>().toEqualTypeOf<kitchensinkDocument>();
    expectTypeOf<Document<kitchensinkQuery>>().toMatchTypeOf<kitchensinkDocument>();
    expectTypeOf<Document<kitchensinkQuery>>().toMatchTypeOf<DocumentNode>();
  });
});
