import type { Kind, OperationTypeNode } from '@0no-co/graphql.web';

export const kitchensinkQuery = `
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

export type kitchensinkDocument = {
  kind: Kind.DOCUMENT;
  definitions: [
    {
      kind: Kind.OPERATION_DEFINITION;
      operation: OperationTypeNode.QUERY;
      name: {
        kind: Kind.NAME;
        value: 'queryName';
      };
      variableDefinitions: [
        {
          kind: Kind.VARIABLE_DEFINITION;
          variable: {
            kind: Kind.VARIABLE;
            name: {
              kind: Kind.NAME;
              value: 'foo';
            };
          };
          type: {
            kind: Kind.NAMED_TYPE;
            name: {
              kind: Kind.NAME;
              value: 'ComplexType';
            };
          };
          defaultValue: undefined;
          directives: undefined;
        },
        {
          kind: Kind.VARIABLE_DEFINITION;
          variable: {
            kind: Kind.VARIABLE;
            name: {
              kind: Kind.NAME;
              value: 'site';
            };
          };
          type: {
            kind: Kind.NAMED_TYPE;
            name: {
              kind: Kind.NAME;
              value: 'Site';
            };
          };
          defaultValue: {
            kind: Kind.ENUM;
            value: 'MOBILE';
          };
          directives: undefined;
        },
      ];
      directives: [
        {
          kind: Kind.DIRECTIVE;
          name: {
            kind: Kind.NAME;
            value: 'onQuery';
          };
          arguments: undefined;
        },
      ];
      selectionSet: {
        kind: Kind.SELECTION_SET;
        selections: [
          {
            kind: Kind.FIELD;
            alias: {
              kind: Kind.NAME;
              value: 'whoever123is';
            };
            name: {
              kind: Kind.NAME;
              value: 'node';
            };
            arguments: [
              {
                kind: Kind.ARGUMENT;
                name: {
                  kind: Kind.NAME;
                  value: 'id';
                };
                value: {
                  kind: Kind.LIST;
                  values: [
                    {
                      kind: Kind.INT;
                      value: string;
                    },
                    {
                      kind: Kind.INT;
                      value: string;
                    },
                  ];
                };
              },
            ];
            directives: undefined;
            selectionSet: {
              kind: Kind.SELECTION_SET;
              selections: [
                {
                  kind: Kind.FIELD;
                  name: {
                    kind: Kind.NAME;
                    value: 'id';
                  };
                  arguments: undefined;
                  directives: undefined;
                  alias: undefined;
                  selectionSet: undefined;
                },
                {
                  kind: Kind.INLINE_FRAGMENT;
                  typeCondition: {
                    kind: Kind.NAMED_TYPE;
                    name: {
                      kind: Kind.NAME;
                      value: 'User';
                    };
                  };
                  directives: [
                    {
                      kind: Kind.DIRECTIVE;
                      name: {
                        kind: Kind.NAME;
                        value: 'onInlineFragment';
                      };
                      arguments: undefined;
                    },
                  ];
                  selectionSet: {
                    kind: Kind.SELECTION_SET;
                    selections: [
                      {
                        kind: Kind.FIELD;
                        name: {
                          kind: Kind.NAME;
                          value: 'field2';
                        };
                        alias: undefined;
                        arguments: undefined;
                        directives: undefined;
                        selectionSet: {
                          kind: Kind.SELECTION_SET;
                          selections: [
                            {
                              kind: Kind.FIELD;
                              name: {
                                kind: Kind.NAME;
                                value: 'id';
                              };
                              arguments: undefined;
                              directives: undefined;
                              alias: undefined;
                              selectionSet: undefined;
                            },
                            {
                              kind: Kind.FIELD;
                              alias: {
                                kind: Kind.NAME;
                                value: 'alias';
                              };
                              name: {
                                kind: Kind.NAME;
                                value: 'field1';
                              };
                              arguments: [
                                {
                                  kind: Kind.ARGUMENT;
                                  name: {
                                    kind: Kind.NAME;
                                    value: 'first';
                                  };
                                  value: {
                                    kind: Kind.INT;
                                    value: string;
                                  };
                                },
                                {
                                  kind: Kind.ARGUMENT;
                                  name: {
                                    kind: Kind.NAME;
                                    value: 'after';
                                  };
                                  value: {
                                    kind: Kind.VARIABLE;
                                    name: {
                                      kind: Kind.NAME;
                                      value: 'foo';
                                    };
                                  };
                                },
                              ];
                              directives: [
                                {
                                  kind: Kind.DIRECTIVE;
                                  name: {
                                    kind: Kind.NAME;
                                    value: 'include';
                                  };
                                  arguments: [
                                    {
                                      kind: Kind.ARGUMENT;
                                      name: {
                                        kind: Kind.NAME;
                                        value: 'if';
                                      };
                                      value: {
                                        kind: Kind.VARIABLE;
                                        name: {
                                          kind: Kind.NAME;
                                          value: 'foo';
                                        };
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
                                      value: 'id';
                                    };
                                    arguments: undefined;
                                    directives: undefined;
                                    alias: undefined;
                                    selectionSet: undefined;
                                  },
                                  {
                                    kind: Kind.FRAGMENT_SPREAD;
                                    name: {
                                      kind: Kind.NAME;
                                      value: 'frag';
                                    };
                                    directives: [
                                      {
                                        kind: Kind.DIRECTIVE;
                                        name: {
                                          kind: Kind.NAME;
                                          value: 'onFragmentSpread';
                                        };
                                        arguments: undefined;
                                      },
                                    ];
                                  },
                                ];
                              };
                            },
                          ];
                        };
                      },
                    ];
                  };
                },
                {
                  kind: Kind.INLINE_FRAGMENT;
                  typeCondition: undefined;
                  directives: [
                    {
                      kind: Kind.DIRECTIVE;
                      name: {
                        kind: Kind.NAME;
                        value: 'skip';
                      };
                      arguments: [
                        {
                          kind: Kind.ARGUMENT;
                          name: {
                            kind: Kind.NAME;
                            value: 'unless';
                          };
                          value: {
                            kind: Kind.VARIABLE;
                            name: {
                              kind: Kind.NAME;
                              value: 'foo';
                            };
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
                          value: 'id';
                        };
                        arguments: undefined;
                        directives: undefined;
                        alias: undefined;
                        selectionSet: undefined;
                      },
                    ];
                  };
                },
                {
                  kind: Kind.INLINE_FRAGMENT;
                  typeCondition: undefined;
                  directives: undefined;
                  selectionSet: {
                    kind: Kind.SELECTION_SET;
                    selections: [
                      {
                        kind: Kind.FIELD;
                        name: {
                          kind: Kind.NAME;
                          value: 'id';
                        };
                        arguments: undefined;
                        directives: undefined;
                        alias: undefined;
                        selectionSet: undefined;
                      },
                    ];
                  };
                },
              ];
            };
          },
        ];
      };
    },
    {
      kind: Kind.OPERATION_DEFINITION;
      operation: OperationTypeNode.MUTATION;
      name: {
        kind: Kind.NAME;
        value: 'likeStory';
      };
      variableDefinitions: [];
      directives: [
        {
          kind: Kind.DIRECTIVE;
          name: {
            kind: Kind.NAME;
            value: 'onMutation';
          };
          arguments: undefined;
        },
      ];
      selectionSet: {
        kind: Kind.SELECTION_SET;
        selections: [
          {
            kind: Kind.FIELD;
            name: {
              kind: Kind.NAME;
              value: 'like';
            };
            alias: undefined;
            arguments: [
              {
                kind: Kind.ARGUMENT;
                name: {
                  kind: Kind.NAME;
                  value: 'story';
                };
                value: {
                  kind: Kind.INT;
                  value: string;
                };
              },
            ];
            directives: [
              {
                kind: Kind.DIRECTIVE;
                name: {
                  kind: Kind.NAME;
                  value: 'onField';
                };
                arguments: undefined;
              },
            ];
            selectionSet: {
              kind: Kind.SELECTION_SET;
              selections: [
                {
                  kind: Kind.FIELD;
                  name: {
                    kind: Kind.NAME;
                    value: 'story';
                  };
                  alias: undefined;
                  arguments: undefined;
                  directives: undefined;
                  selectionSet: {
                    kind: Kind.SELECTION_SET;
                    selections: [
                      {
                        kind: Kind.FIELD;
                        name: {
                          kind: Kind.NAME;
                          value: 'id';
                        };
                        arguments: undefined;
                        directives: [
                          {
                            kind: Kind.DIRECTIVE;
                            name: {
                              kind: Kind.NAME;
                              value: 'onField';
                            };
                            arguments: undefined;
                          },
                        ];
                        alias: undefined;
                        selectionSet: undefined;
                      },
                    ];
                  };
                },
              ];
            };
          },
        ];
      };
    },
    {
      kind: Kind.OPERATION_DEFINITION;
      operation: OperationTypeNode.SUBSCRIPTION;
      name: {
        kind: Kind.NAME;
        value: 'StoryLikeSubscription';
      };
      variableDefinitions: [
        {
          kind: Kind.VARIABLE_DEFINITION;
          variable: {
            kind: Kind.VARIABLE;
            name: {
              kind: Kind.NAME;
              value: 'input';
            };
          };
          type: {
            kind: Kind.NAMED_TYPE;
            name: {
              kind: Kind.NAME;
              value: 'StoryLikeSubscribeInput';
            };
          };
          directives: undefined;
          defaultValue: undefined;
        },
      ];
      directives: [
        {
          kind: Kind.DIRECTIVE;
          name: {
            kind: Kind.NAME;
            value: 'onSubscription';
          };
          arguments: undefined;
        },
      ];
      selectionSet: {
        kind: Kind.SELECTION_SET;
        selections: [
          {
            kind: Kind.FIELD;
            name: {
              kind: Kind.NAME;
              value: 'storyLikeSubscribe';
            };
            alias: undefined;
            arguments: [
              {
                kind: Kind.ARGUMENT;
                name: {
                  kind: Kind.NAME;
                  value: 'input';
                };
                value: {
                  kind: Kind.VARIABLE;
                  name: {
                    kind: Kind.NAME;
                    value: 'input';
                  };
                };
              },
            ];
            directives: undefined;
            selectionSet: {
              kind: Kind.SELECTION_SET;
              selections: [
                {
                  kind: Kind.FIELD;
                  name: {
                    kind: Kind.NAME;
                    value: 'story';
                  };
                  alias: undefined;
                  arguments: undefined;
                  directives: undefined;
                  selectionSet: {
                    kind: Kind.SELECTION_SET;
                    selections: [
                      {
                        kind: Kind.FIELD;
                        name: {
                          kind: Kind.NAME;
                          value: 'likers';
                        };
                        alias: undefined;
                        arguments: undefined;
                        directives: undefined;
                        selectionSet: {
                          kind: Kind.SELECTION_SET;
                          selections: [
                            {
                              kind: Kind.FIELD;
                              name: {
                                kind: Kind.NAME;
                                value: 'count';
                              };
                              alias: undefined;
                              selectionSet: undefined;
                              arguments: undefined;
                              directives: undefined;
                            },
                          ];
                        };
                      },
                      {
                        kind: Kind.FIELD;
                        name: {
                          kind: Kind.NAME;
                          value: 'likeSentence';
                        };
                        alias: undefined;
                        arguments: undefined;
                        directives: undefined;
                        selectionSet: {
                          kind: Kind.SELECTION_SET;
                          selections: [
                            {
                              kind: Kind.FIELD;
                              name: {
                                kind: Kind.NAME;
                                value: 'text';
                              };
                              alias: undefined;
                              selectionSet: undefined;
                              arguments: undefined;
                              directives: undefined;
                            },
                          ];
                        };
                      },
                    ];
                  };
                },
              ];
            };
          },
        ];
      };
    },
    {
      kind: Kind.FRAGMENT_DEFINITION;
      name: {
        kind: Kind.NAME;
        value: 'frag';
      };
      typeCondition: {
        kind: Kind.NAMED_TYPE;
        name: {
          kind: Kind.NAME;
          value: 'Friend';
        };
      };
      directives: [
        {
          kind: Kind.DIRECTIVE;
          name: {
            kind: Kind.NAME;
            value: 'onFragmentDefinition';
          };
          arguments: undefined;
        },
      ];
      selectionSet: {
        kind: Kind.SELECTION_SET;
        selections: [
          {
            kind: Kind.FIELD;
            name: {
              kind: Kind.NAME;
              value: 'foo';
            };
            alias: undefined;
            selectionSet: undefined;
            arguments: [
              {
                kind: Kind.ARGUMENT;
                name: {
                  kind: Kind.NAME;
                  value: 'size';
                };
                value: {
                  kind: Kind.VARIABLE;
                  name: {
                    kind: Kind.NAME;
                    value: 'site';
                  };
                };
              },
              {
                kind: Kind.ARGUMENT;
                name: {
                  kind: Kind.NAME;
                  value: 'bar';
                };
                value: {
                  kind: Kind.INT;
                  value: string;
                };
              },
              {
                kind: Kind.ARGUMENT;
                name: {
                  kind: Kind.NAME;
                  value: 'obj';
                };
                value: {
                  kind: Kind.OBJECT;
                  fields: [
                    {
                      kind: Kind.OBJECT_FIELD;
                      name: {
                        kind: Kind.NAME;
                        value: 'key';
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
                        value: 'block';
                      };
                      value: {
                        kind: Kind.STRING;
                        value: string;
                        block: true;
                      };
                    },
                  ];
                };
              },
            ];
            directives: undefined;
          },
        ];
      };
    },
    {
      kind: Kind.OPERATION_DEFINITION;
      operation: OperationTypeNode.QUERY;
      name: {
        kind: Kind.NAME;
        value: 'teeny';
      };
      variableDefinitions: [];
      directives: undefined;
      selectionSet: {
        kind: Kind.SELECTION_SET;
        selections: [
          {
            kind: Kind.FIELD;
            name: {
              kind: Kind.NAME;
              value: 'unnamed';
            };
            alias: undefined;
            selectionSet: undefined;
            arguments: [
              {
                kind: Kind.ARGUMENT;
                name: {
                  kind: Kind.NAME;
                  value: 'truthy';
                };
                value: {
                  kind: Kind.BOOLEAN;
                  value: boolean;
                };
              },
              {
                kind: Kind.ARGUMENT;
                name: {
                  kind: Kind.NAME;
                  value: 'falsey';
                };
                value: {
                  kind: Kind.BOOLEAN;
                  value: boolean;
                };
              },
              {
                kind: Kind.ARGUMENT;
                name: {
                  kind: Kind.NAME;
                  value: 'nullish';
                };
                value: {
                  kind: Kind.NULL;
                };
              },
            ];
            directives: undefined;
          },
          {
            kind: Kind.FIELD;
            name: {
              kind: Kind.NAME;
              value: 'query';
            };
            alias: undefined;
            selectionSet: undefined;
            arguments: undefined;
            directives: undefined;
          },
        ];
      };
    },
    {
      kind: Kind.OPERATION_DEFINITION;
      operation: OperationTypeNode.QUERY;
      name: {
        kind: Kind.NAME;
        value: 'tiny';
      };
      variableDefinitions: [];
      directives: undefined;
      selectionSet: {
        kind: Kind.SELECTION_SET;
        selections: [
          {
            kind: Kind.FIELD;
            name: {
              kind: Kind.NAME;
              value: '__typename';
            };
            alias: undefined;
            selectionSet: undefined;
            arguments: undefined;
            directives: undefined;
          },
        ];
      };
    },
  ];
};
