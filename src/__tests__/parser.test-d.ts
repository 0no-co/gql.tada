import { test, assertType } from 'vitest';
import type { DocumentNode } from '@0no-co/graphql.web';

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

const any = {} as any;

test('parses variable inline values', () => {
  const actual = any as TakeValue<'{ a: { b: [ $var ] } }', false>;
  assertType<
    [
      {
        kind: 'ObjectValue';
        fields: [
          {
            kind: 'ObjectField';
            name: {
              kind: 'Name';
              value: 'a';
            };
            value: {
              kind: 'ObjectValue';
              fields: [
                {
                  kind: 'ObjectField';
                  name: {
                    kind: 'Name';
                    value: 'b';
                  };
                  value: {
                    kind: 'ListValue';
                    values: [
                      {
                        kind: 'Variable';
                        name: {
                          kind: 'Name';
                          value: 'var';
                        };
                      }
                    ];
                  };
                }
              ];
            };
          }
        ];
      },
      ''
    ]
  >(actual);
});

test('parses variable definitions', () => {
  assertType<
    [
      [
        {
          kind: 'VariableDefinition';
          variable: {
            kind: 'Variable';
            name: {
              kind: 'Name';
              value: 'x';
            };
          };
          type: {
            kind: 'NamedType';
            name: {
              kind: 'Name';
              value: 'A';
            };
          };
          defaultValue: undefined;
        }
      ],
      ''
    ]
  >(any as TakeVarDefinitions<'($x: A)'>);

  assertType<
    [
      [
        {
          kind: 'VariableDefinition';
          variable: {
            kind: 'Variable';
            name: {
              kind: 'Name';
              value: 'x';
            };
          };
          type: {
            kind: 'NamedType';
            name: {
              kind: 'Name';
              value: 'A';
            };
          };
          defaultValue: undefined;
        },
        {
          kind: 'VariableDefinition';
          variable: {
            kind: 'Variable';
            name: {
              kind: 'Name';
              value: 'y';
            };
          };
          type: {
            kind: 'NamedType';
            name: {
              kind: 'Name';
              value: 'B';
            };
          };
          defaultValue: undefined;
        }
      ],
      ''
    ]
  >(any as TakeVarDefinitions<'($x: A, $y: B)'>);
});

test('parses constant default values', () => {
  const actualPass = any as TakeVarDefinition<'$x: Complex = "42"'>;
  const actualFail = any as TakeVarDefinition<'$x: Complex = $var'>;

  assertType<
    [
      {
        kind: 'VariableDefinition';
        variable: {
          kind: 'Variable';
          name: {
            kind: 'Name';
            value: 'x';
          };
        };
        type: {
          kind: 'NamedType';
          name: {
            kind: 'Name';
            value: 'Complex';
          };
        };
        defaultValue: {
          kind: 'StringValue';
          value: string;
          block: false;
        };
        directives: [];
      },
      ''
    ]
  >(actualPass);

  assertType<void>(actualFail);
});

test('parses variable definition directives', () => {
  const actual = any as TakeVarDefinition<'$x: Boolean = false @bar'>;

  assertType<
    [
      {
        kind: 'VariableDefinition';
        variable: {
          kind: 'Variable';
          name: {
            kind: 'Name';
            value: 'x';
          };
        };
        type: {
          kind: 'NamedType';
          name: {
            kind: 'Name';
            value: 'Boolean';
          };
        };
        defaultValue: {
          kind: 'BooleanValue';
          value: boolean;
        };
        directives: [
          {
            kind: 'Directive';
            name: {
              kind: 'Name';
              value: 'bar';
            };
            arguments: [];
          }
        ];
      },
      ''
    ]
  >(actual);
});

test('does not accept fragment spread of "on"', () => {
  const actualPass = any as TakeSelectionSetContinue<'{ ...On }'>;
  const actualFail = any as TakeSelectionSetContinue<'{ ...on }'>;

  assertType<
    [
      {
        kind: 'SelectionSet';
        selections: [
          {
            kind: 'FragmentSpread';
            directives: [];
            name: {
              kind: 'Name';
              value: 'On';
            };
          }
        ];
      },
      ''
    ]
  >(actualPass);

  assertType<void>(actualFail);
});

test('parses anonymous mutation operations', () => {
  const actual = any as TakeOperationDefinition<'mutation { mutationField }'>;

  assertType<
    [
      {
        kind: 'OperationDefinition';
        operation: 'mutation';
        name: undefined;
        selectionSet: {
          kind: 'SelectionSet';
          selections: [
            {
              kind: 'Field';
              name: {
                kind: 'Name';
                value: 'mutationField';
              };
            }
          ];
        };
      },
      ''
    ]
  >(actual);
});

test('parses named mutation operations', () => {
  const actual = any as TakeOperationDefinition<'mutation Foo { mutationField }'>;

  assertType<
    [
      {
        kind: 'OperationDefinition';
        operation: 'mutation';
        name: {
          kind: 'Name';
          value: 'Foo';
        };
        selectionSet: {
          kind: 'SelectionSet';
          selections: [
            {
              kind: 'Field';
              name: {
                kind: 'Name';
                value: 'mutationField';
              };
            }
          ];
        };
      },
      ''
    ]
  >(actual);
});

test('parses fragment definitions', () => {
  assertType<void>(any as TakeFragmentDefinition<'fragment { test }'>);
  assertType<void>(any as TakeFragmentDefinition<'fragment name { test }'>);
  assertType<void>(any as TakeFragmentDefinition<'fragment name on name'>);

  const actual = any as TakeFragmentDefinition<'fragment name on Type { field }'>;

  assertType<
    [
      {
        kind: 'FragmentDefinition';
        name: {
          kind: 'Name';
          value: 'name';
        };
        typeCondition: {
          kind: 'NamedType';
          name: {
            kind: 'Name';
            value: 'Type';
          };
        };
        directives: [];
        selectionSet: {
          kind: 'SelectionSet';
          selections: [
            {
              kind: 'Field';
              name: {
                kind: 'Name';
                value: 'field';
              };
            }
          ];
        };
      },
      ''
    ]
  >(actual);
});

test('parses fields', () => {
  assertType<void>(any as TakeField<'field: '>);
  assertType<void>(any as TakeField<'alias: field()'>);

  const actual = any as TakeField<'alias: field @test(arg: null) { child }'>;

  assertType<
    [
      {
        kind: 'Field';
        alias: {
          kind: 'Name';
          value: 'alias';
        };
        name: {
          kind: 'Name';
          value: 'field';
        };
        directives: [
          {
            kind: 'Directive';
            name: {
              kind: 'Name';
              value: 'test';
            };
            arguments: [
              {
                kind: 'Argument';
                name: {
                  kind: 'Name';
                  value: 'arg';
                };
                value: {
                  kind: 'NullValue';
                };
              }
            ];
          }
        ];
        selectionSet: {
          kind: 'SelectionSet';
          selections: [
            {
              kind: 'Field';
              name: {
                kind: 'Name';
                value: 'child';
              };
            }
          ];
        };
      },
      ''
    ]
  >(actual);
});

test('parses arguments', () => {
  assertType<void>(any as TakeField<'field()'>);
  assertType<void>(any as TakeField<'field(name)'>);
  assertType<void>(any as TakeField<'field(name:)'>);
  assertType<void>(any as TakeField<'field(name: null'>);

  const actual = any as TakeField<'field(a: null, b: null)'>;

  assertType<
    [
      {
        kind: 'Field';
        alias: undefined;
        name: {
          kind: 'Name';
          value: 'field';
        };
        arguments: [
          {
            name: {
              kind: 'Name';
              value: 'a';
            };
            value: {
              kind: 'NullValue';
            };
          },
          {
            name: {
              kind: 'Name';
              value: 'b';
            };
            value: {
              kind: 'NullValue';
            };
          }
        ];
        directives: [];
        selectionSet: undefined;
      },
      ''
    ]
  >(actual);
});

test('parses directives', () => {
  assertType<void>(any as TakeDirective<'@', false>);
  assertType<void>(any as TakeDirective<'@(test: null)', false>);

  const actual = any as TakeDirective<'@test(name: null)', false>;

  assertType<
    [
      {
        kind: 'Directive';
        name: {
          kind: 'Name';
          value: 'test';
        };
        arguments: [
          {
            kind: 'Argument';
            name: {
              kind: 'Name';
              value: 'name';
            };
            value: {
              kind: 'NullValue';
            };
          }
        ];
      },
      ''
    ]
  >(actual);
});

test('parses inline fragments', () => {
  assertType<void>(any as TakeFragmentSpread<'... on Test'>);
  assertType<void>(any as TakeFragmentSpread<'...'>);

  const actual = any as TakeFragmentSpread<'... on Test { field }'>;

  assertType<
    [
      {
        kind: 'InlineFragment';
        typeCondition: {
          kind: 'NamedType';
          name: {
            kind: 'Name';
            value: 'Test';
          };
        };
        selectionSet: {
          kind: 'SelectionSet';
          selections: [
            {
              kind: 'Field';
              name: {
                kind: 'Name';
                value: 'field';
              };
            }
          ];
        };
      },
      ''
    ]
  >(actual);
});

test('parses conditionless inline fragments', () => {
  assertType<void>(any as TakeFragmentSpread<'... on Test'>);
  assertType<void>(any as TakeFragmentSpread<'...'>);

  const actual = any as TakeFragmentSpread<'... { field }'>;

  assertType<
    [
      {
        kind: 'InlineFragment';
        typeCondition: undefined;
        selectionSet: {
          kind: 'SelectionSet';
          selections: [
            {
              kind: 'Field';
              name: {
                kind: 'Name';
                value: 'field';
              };
            }
          ];
        };
      },
      ''
    ]
  >(actual);
});

test('parses basic values', () => {
  assertType<void>(any as TakeValue<'', false>);
  assertType<void>(any as TakeValue<'$', false>);
  assertType<void>(any as TakeValue<':', false>);
  assertType<[{ kind: 'NullValue' }, '']>(any as TakeValue<'null', false>);
  assertType<[{ kind: 'BooleanValue' }, '']>(any as TakeValue<'true', false>);
  assertType<[{ kind: 'BooleanValue' }, '']>(any as TakeValue<'false', false>);
  assertType<[{ kind: 'EnumValue' }, '']>(any as TakeValue<'SOME_CONST', false>);
});

test('parses list values', () => {
  assertType<
    [
      {
        kind: 'ListValue';
        values: [
          {
            kind: 'IntValue';
            value: string;
          },
          {
            kind: 'StringValue';
            value: string;
            block: false;
          }
        ];
      },
      ''
    ]
  >(any as TakeValue<'[123 "abc"]', false>);
});

test('parses integers', () => {
  assertType<void>(any as TakeValue<'-', false>);
  assertType<[{ kind: 'IntValue' }, '']>(any as TakeValue<'12', false>);
  assertType<[{ kind: 'IntValue' }, '']>(any as TakeValue<'-12', false>);
});

test('parses floats', () => {
  assertType<void>(any as TakeValue<'-.0e', false>);
  assertType<[{ kind: 'FloatValue' }, '']>(any as TakeValue<'12e2', false>);
  assertType<[{ kind: 'FloatValue' }, '']>(any as TakeValue<'0.2E3', false>);
  assertType<[{ kind: 'FloatValue' }, '']>(any as TakeValue<'-1.2e+3', false>);
});

test('parses strings', () => {
  assertType<[{ kind: 'StringValue' }, '']>(any as TakeValue<'""', false>);
  assertType<[{ kind: 'StringValue' }, '']>(any as TakeValue<'"\\t\\t"', false>);
  assertType<[{ kind: 'StringValue' }, '']>(any as TakeValue<'" \\" "', false>);
  assertType<[{ kind: 'StringValue' }, ' "x"']>(any as TakeValue<'"x" "x"', false>);
  assertType<[{ kind: 'StringValue' }, ' ""']>(any as TakeValue<'"" ""', false>);
  assertType<[{ kind: 'StringValue' }, ' ""']>(any as TakeValue<'" \\" " ""', false>);
});

test('parses block strings', () => {
  const x = `""" 
    \\"""
  """` as const;

  assertType<[{ kind: 'StringValue'; block: true }, '']>(any as TakeValue<'""""""', false>);
  assertType<[{ kind: 'StringValue'; block: true }, '']>(any as TakeValue<'"""\n"""', false>);
  assertType<[{ kind: 'StringValue'; block: true }, '']>(any as TakeValue<'""" \\""" """', false>);
  assertType<[{ kind: 'StringValue'; block: true }, '']>(any as TakeValue<typeof x, false>);
});

test('parses objects', () => {
  assertType<[{ kind: 'ObjectValue' }, '']>(any as TakeValue<'{}', false>);

  assertType<void>(any as TakeValue<'{name}', false>);
  assertType<void>(any as TakeValue<'{name:}', false>);
  assertType<void>(any as TakeValue<'{name:null', false>);

  assertType<
    [
      {
        kind: 'ObjectValue';
        fields: [
          {
            kind: 'ObjectField';
            name: {
              kind: 'Name';
              value: 'name';
            };
            value: {
              kind: 'NullValue';
            };
          }
        ];
      },
      ''
    ]
  >(any as TakeValue<'{name:null}', false>);

  assertType<
    [
      {
        kind: 'ObjectValue';
        fields: [
          {
            kind: 'ObjectField';
            name: {
              kind: 'Name';
              value: 'a';
            };
            value: {
              kind: 'StringValue';
              value: string;
            };
          }
        ];
      },
      ''
    ]
  >(any as TakeValue<'{a:"a"}', false>);

  assertType<
    [
      {
        kind: 'ObjectValue';
        fields: [
          {
            kind: 'ObjectField';
            name: {
              kind: 'Name';
              value: 'a';
            };
            value: {
              kind: 'StringValue';
              value: string;
            };
          },
          {
            kind: 'ObjectField';
            name: {
              kind: 'Name';
              value: 'b';
            };
            value: {
              kind: 'StringValue';
              value: string;
            };
          }
        ];
      },
      ''
    ]
  >(any as TakeValue<'{a:"a"\nb: """\n\\"""\n"""}', false>);
});

test('parses lists', () => {
  assertType<[{ kind: 'ListValue' }, '']>(any as TakeValue<'[]', false>);

  assertType<void>(any as TakeValue<'[', false>);
  assertType<void>(any as TakeValue<'[null', false>);

  assertType<
    [
      {
        kind: 'ListValue';
        values: [
          {
            kind: 'NullValue';
          }
        ];
      },
      ''
    ]
  >(any as TakeValue<'[null]', false>);
});

test('parses block strings', () => {
  assertType<[{ kind: 'ListValue' }, '']>(any as TakeValue<'[]', false>);

  assertType<void>(any as TakeValue<'[', false>);
  assertType<void>(any as TakeValue<'[null', false>);

  assertType<
    [
      {
        kind: 'ListValue';
        values: [
          {
            kind: 'NullValue';
          }
        ];
      },
      ''
    ]
  >(any as TakeValue<'[null]', false>);
});

test('allows variables', () => {
  assertType<
    [
      {
        kind: 'ListValue';
        values: [
          {
            kind: 'Variable';
            name: {
              kind: 'Name';
              value: 'var';
            };
          }
        ];
      },
      ''
    ]
  >(any as TakeValue<'[$var]', false>);

  assertType<void>(any as TakeValue<'[$var]', true>);
});

test('parses basic types', () => {
  assertType<void>(any as TakeType<''>);
  assertType<void>(any as TakeType<'['>);

  assertType<
    [
      {
        kind: 'NamedType';
        name: {
          kind: 'Name';
          value: 'Type';
        };
      },
      ''
    ]
  >(any as TakeType<'Type'>);

  assertType<
    [
      {
        kind: 'NonNullType';
        type: {
          kind: 'NamedType';
          name: {
            kind: 'Name';
            value: 'Type';
          };
        };
      },
      ''
    ]
  >(any as TakeType<'Type!'>);

  assertType<
    [
      {
        kind: 'ListType';
        type: {
          kind: 'NonNullType';
          type: {
            kind: 'NamedType';
            name: {
              kind: 'Name';
              value: 'Type';
            };
          };
        };
      },
      ''
    ]
  >(any as TakeType<'[Type!]'>);

  assertType<
    [
      {
        kind: 'NonNullType';
        type: {
          kind: 'ListType';
          type: {
            kind: 'NonNullType';
            type: {
              kind: 'NamedType';
              name: {
                kind: 'Name';
                value: 'Type';
              };
            };
          };
        };
      },
      ''
    ]
  >(any as TakeType<'[Type!]!'>);
});

test('parses kitchen sink query', () => {
  const query = `
    # Copyright (c) 2015-present, Facebook, Inc.
    #
    # This source code is licensed under the MIT license found in the
    # LICENSE file in the root directory of this source tree.

    query queryName($foo: ComplexType, $site: Site = MOBILE) @onQuery {
      whoever123is: node(id: [123, 456]) {
        id
        ... on User @onInlineFragment {
          field2 {
            id
            alias: field1(first: 10, after: $foo) @include(if: $foo) {
              id
              ...frag @onFragmentSpread
            }
          }
        }
        ... @skip(unless: $foo) {
          id
        }
        ... {
          id
        }
      }
    }

    mutation likeStory @onMutation {
      like(story: 123) @onField {
        story {
          id @onField
        }
      }
    }

    subscription StoryLikeSubscription($input: StoryLikeSubscribeInput)
    @onSubscription {
      storyLikeSubscribe(input: $input) {
        story {
          likers {
            count
          }
          likeSentence {
            text
          }
        }
      }
    }

    fragment frag on Friend @onFragmentDefinition {
      foo(
        size: $site
        bar: 12
        obj: {
          key: "value"
          block: """
            \\"""
          """
        }
      )
    }

    query teeny {
      unnamed(truthy: true, falsey: false, nullish: null)
      query
    }

    query tiny {
      __typename
    }
  ` as const;

  type actual = {
    kind: 'Document';
    definitions: [
      {
        kind: 'OperationDefinition';
        operation: 'query';
        name: {
          kind: 'Name';
          value: 'queryName';
        };
        variableDefinitions: [
          {
            kind: 'VariableDefinition';
            variable: {
              kind: 'Variable';
              name: {
                kind: 'Name';
                value: 'foo';
              };
            };
            type: {
              kind: 'NamedType';
              name: {
                kind: 'Name';
                value: 'ComplexType';
              };
            };
            directives: [];
          },
          {
            kind: 'VariableDefinition';
            variable: {
              kind: 'Variable';
              name: {
                kind: 'Name';
                value: 'site';
              };
            };
            type: {
              kind: 'NamedType';
              name: {
                kind: 'Name';
                value: 'Site';
              };
            };
            defaultValue: {
              kind: 'EnumValue';
              value: 'MOBILE';
            };
            directives: [];
          }
        ];
        directives: [
          {
            kind: 'Directive';
            name: {
              kind: 'Name';
              value: 'onQuery';
            };
            arguments: [];
          }
        ];
        selectionSet: {
          kind: 'SelectionSet';
          selections: [
            {
              kind: 'Field';
              alias: {
                kind: 'Name';
                value: 'whoever123is';
              };
              name: {
                kind: 'Name';
                value: 'node';
              };
              arguments: [
                {
                  kind: 'Argument';
                  name: {
                    kind: 'Name';
                    value: 'id';
                  };
                  value: {
                    kind: 'ListValue';
                    values: [
                      {
                        kind: 'IntValue';
                        value: string;
                      },
                      {
                        kind: 'IntValue';
                        value: string;
                      }
                    ];
                  };
                }
              ];
              directives: [];
              selectionSet: {
                kind: 'SelectionSet';
                selections: [
                  {
                    kind: 'Field';
                    name: {
                      kind: 'Name';
                      value: 'id';
                    };
                    arguments: [];
                    directives: [];
                  },
                  {
                    kind: 'InlineFragment';
                    typeCondition: {
                      kind: 'NamedType';
                      name: {
                        kind: 'Name';
                        value: 'User';
                      };
                    };
                    directives: [
                      {
                        kind: 'Directive';
                        name: {
                          kind: 'Name';
                          value: 'onInlineFragment';
                        };
                        arguments: [];
                      }
                    ];
                    selectionSet: {
                      kind: 'SelectionSet';
                      selections: [
                        {
                          kind: 'Field';
                          name: {
                            kind: 'Name';
                            value: 'field2';
                          };
                          arguments: [];
                          directives: [];
                          selectionSet: {
                            kind: 'SelectionSet';
                            selections: [
                              {
                                kind: 'Field';
                                name: {
                                  kind: 'Name';
                                  value: 'id';
                                };
                                arguments: [];
                                directives: [];
                              },
                              {
                                kind: 'Field';
                                alias: {
                                  kind: 'Name';
                                  value: 'alias';
                                };
                                name: {
                                  kind: 'Name';
                                  value: 'field1';
                                };
                                arguments: [
                                  {
                                    kind: 'Argument';
                                    name: {
                                      kind: 'Name';
                                      value: 'first';
                                    };
                                    value: {
                                      kind: 'IntValue';
                                      value: string;
                                    };
                                  },
                                  {
                                    kind: 'Argument';
                                    name: {
                                      kind: 'Name';
                                      value: 'after';
                                    };
                                    value: {
                                      kind: 'Variable';
                                      name: {
                                        kind: 'Name';
                                        value: 'foo';
                                      };
                                    };
                                  }
                                ];
                                directives: [
                                  {
                                    kind: 'Directive';
                                    name: {
                                      kind: 'Name';
                                      value: 'include';
                                    };
                                    arguments: [
                                      {
                                        kind: 'Argument';
                                        name: {
                                          kind: 'Name';
                                          value: 'if';
                                        };
                                        value: {
                                          kind: 'Variable';
                                          name: {
                                            kind: 'Name';
                                            value: 'foo';
                                          };
                                        };
                                      }
                                    ];
                                  }
                                ];
                                selectionSet: {
                                  kind: 'SelectionSet';
                                  selections: [
                                    {
                                      kind: 'Field';
                                      name: {
                                        kind: 'Name';
                                        value: 'id';
                                      };
                                      arguments: [];
                                      directives: [];
                                    },
                                    {
                                      kind: 'FragmentSpread';
                                      name: {
                                        kind: 'Name';
                                        value: 'frag';
                                      };
                                      directives: [
                                        {
                                          kind: 'Directive';
                                          name: {
                                            kind: 'Name';
                                            value: 'onFragmentSpread';
                                          };
                                          arguments: [];
                                        }
                                      ];
                                    }
                                  ];
                                };
                              }
                            ];
                          };
                        }
                      ];
                    };
                  },
                  {
                    kind: 'InlineFragment';
                    directives: [
                      {
                        kind: 'Directive';
                        name: {
                          kind: 'Name';
                          value: 'skip';
                        };
                        arguments: [
                          {
                            kind: 'Argument';
                            name: {
                              kind: 'Name';
                              value: 'unless';
                            };
                            value: {
                              kind: 'Variable';
                              name: {
                                kind: 'Name';
                                value: 'foo';
                              };
                            };
                          }
                        ];
                      }
                    ];
                    selectionSet: {
                      kind: 'SelectionSet';
                      selections: [
                        {
                          kind: 'Field';
                          name: {
                            kind: 'Name';
                            value: 'id';
                          };
                          arguments: [];
                          directives: [];
                        }
                      ];
                    };
                  },
                  {
                    kind: 'InlineFragment';
                    directives: [];
                    selectionSet: {
                      kind: 'SelectionSet';
                      selections: [
                        {
                          kind: 'Field';
                          name: {
                            kind: 'Name';
                            value: 'id';
                          };
                          arguments: [];
                          directives: [];
                        }
                      ];
                    };
                  }
                ];
              };
            }
          ];
        };
      },
      {
        kind: 'OperationDefinition';
        operation: 'mutation';
        name: {
          kind: 'Name';
          value: 'likeStory';
        };
        variableDefinitions: [];
        directives: [
          {
            kind: 'Directive';
            name: {
              kind: 'Name';
              value: 'onMutation';
            };
            arguments: [];
          }
        ];
        selectionSet: {
          kind: 'SelectionSet';
          selections: [
            {
              kind: 'Field';
              name: {
                kind: 'Name';
                value: 'like';
              };
              arguments: [
                {
                  kind: 'Argument';
                  name: {
                    kind: 'Name';
                    value: 'story';
                  };
                  value: {
                    kind: 'IntValue';
                    value: string;
                  };
                }
              ];
              directives: [
                {
                  kind: 'Directive';
                  name: {
                    kind: 'Name';
                    value: 'onField';
                  };
                  arguments: [];
                }
              ];
              selectionSet: {
                kind: 'SelectionSet';
                selections: [
                  {
                    kind: 'Field';
                    name: {
                      kind: 'Name';
                      value: 'story';
                    };
                    arguments: [];
                    directives: [];
                    selectionSet: {
                      kind: 'SelectionSet';
                      selections: [
                        {
                          kind: 'Field';
                          name: {
                            kind: 'Name';
                            value: 'id';
                          };
                          arguments: [];
                          directives: [
                            {
                              kind: 'Directive';
                              name: {
                                kind: 'Name';
                                value: 'onField';
                              };
                              arguments: [];
                            }
                          ];
                        }
                      ];
                    };
                  }
                ];
              };
            }
          ];
        };
      },
      {
        kind: 'OperationDefinition';
        operation: 'subscription';
        name: {
          kind: 'Name';
          value: 'StoryLikeSubscription';
        };
        variableDefinitions: [
          {
            kind: 'VariableDefinition';
            variable: {
              kind: 'Variable';
              name: {
                kind: 'Name';
                value: 'input';
              };
            };
            type: {
              kind: 'NamedType';
              name: {
                kind: 'Name';
                value: 'StoryLikeSubscribeInput';
              };
            };
            directives: [];
          }
        ];
        directives: [
          {
            kind: 'Directive';
            name: {
              kind: 'Name';
              value: 'onSubscription';
            };
            arguments: [];
          }
        ];
        selectionSet: {
          kind: 'SelectionSet';
          selections: [
            {
              kind: 'Field';
              name: {
                kind: 'Name';
                value: 'storyLikeSubscribe';
              };
              arguments: [
                {
                  kind: 'Argument';
                  name: {
                    kind: 'Name';
                    value: 'input';
                  };
                  value: {
                    kind: 'Variable';
                    name: {
                      kind: 'Name';
                      value: 'input';
                    };
                  };
                }
              ];
              directives: [];
              selectionSet: {
                kind: 'SelectionSet';
                selections: [
                  {
                    kind: 'Field';
                    name: {
                      kind: 'Name';
                      value: 'story';
                    };
                    arguments: [];
                    directives: [];
                    selectionSet: {
                      kind: 'SelectionSet';
                      selections: [
                        {
                          kind: 'Field';
                          name: {
                            kind: 'Name';
                            value: 'likers';
                          };
                          arguments: [];
                          directives: [];
                          selectionSet: {
                            kind: 'SelectionSet';
                            selections: [
                              {
                                kind: 'Field';
                                name: {
                                  kind: 'Name';
                                  value: 'count';
                                };
                                arguments: [];
                                directives: [];
                              }
                            ];
                          };
                        },
                        {
                          kind: 'Field';
                          name: {
                            kind: 'Name';
                            value: 'likeSentence';
                          };
                          arguments: [];
                          directives: [];
                          selectionSet: {
                            kind: 'SelectionSet';
                            selections: [
                              {
                                kind: 'Field';
                                name: {
                                  kind: 'Name';
                                  value: 'text';
                                };
                                arguments: [];
                                directives: [];
                              }
                            ];
                          };
                        }
                      ];
                    };
                  }
                ];
              };
            }
          ];
        };
      },
      {
        kind: 'FragmentDefinition';
        name: {
          kind: 'Name';
          value: 'frag';
        };
        typeCondition: {
          kind: 'NamedType';
          name: {
            kind: 'Name';
            value: 'Friend';
          };
        };
        directives: [
          {
            kind: 'Directive';
            name: {
              kind: 'Name';
              value: 'onFragmentDefinition';
            };
            arguments: [];
          }
        ];
        selectionSet: {
          kind: 'SelectionSet';
          selections: [
            {
              kind: 'Field';
              name: {
                kind: 'Name';
                value: 'foo';
              };
              arguments: [
                {
                  kind: 'Argument';
                  name: {
                    kind: 'Name';
                    value: 'size';
                  };
                  value: {
                    kind: 'Variable';
                    name: {
                      kind: 'Name';
                      value: 'site';
                    };
                  };
                },
                {
                  kind: 'Argument';
                  name: {
                    kind: 'Name';
                    value: 'bar';
                  };
                  value: {
                    kind: 'IntValue';
                    value: string;
                  };
                },
                {
                  kind: 'Argument';
                  name: {
                    kind: 'Name';
                    value: 'obj';
                  };
                  value: {
                    kind: 'ObjectValue';
                    fields: [
                      {
                        kind: 'ObjectField';
                        name: {
                          kind: 'Name';
                          value: 'key';
                        };
                        value: {
                          kind: 'StringValue';
                          value: string;
                        };
                      },
                      {
                        kind: 'ObjectField';
                        name: {
                          kind: 'Name';
                          value: 'block';
                        };
                        value: {
                          kind: 'StringValue';
                          value: string;
                        };
                      }
                    ];
                  };
                }
              ];
              directives: [];
            }
          ];
        };
      },
      {
        kind: 'OperationDefinition';
        operation: 'query';
        name: {
          kind: 'Name';
          value: 'teeny';
        };
        variableDefinitions: [];
        directives: [];
        selectionSet: {
          kind: 'SelectionSet';
          selections: [
            {
              kind: 'Field';
              name: {
                kind: 'Name';
                value: 'unnamed';
              };
              arguments: [
                {
                  kind: 'Argument';
                  name: {
                    kind: 'Name';
                    value: 'truthy';
                  };
                  value: {
                    kind: 'BooleanValue';
                    value: boolean;
                  };
                },
                {
                  kind: 'Argument';
                  name: {
                    kind: 'Name';
                    value: 'falsey';
                  };
                  value: {
                    kind: 'BooleanValue';
                    value: boolean;
                  };
                },
                {
                  kind: 'Argument';
                  name: {
                    kind: 'Name';
                    value: 'nullish';
                  };
                  value: {
                    kind: 'NullValue';
                  };
                }
              ];
              directives: [];
            },
            {
              kind: 'Field';
              name: {
                kind: 'Name';
                value: 'query';
              };
              arguments: [];
              directives: [];
            }
          ];
        };
      },
      {
        kind: 'OperationDefinition';
        operation: 'query';
        name: {
          kind: 'Name';
          value: 'tiny';
        };
        variableDefinitions: [];
        directives: [];
        selectionSet: {
          kind: 'SelectionSet';
          selections: [
            {
              kind: 'Field';
              name: {
                kind: 'Name';
                value: '__typename';
              };
              arguments: [];
              directives: [];
            }
          ];
        };
      }
    ];
  };

  const expected = any as Document<typeof query>;
  assertType<actual>(expected);

  // NOTE: This must also be able to pass the `DocumentNode` type
  assertType<DocumentNode>(expected);
});
