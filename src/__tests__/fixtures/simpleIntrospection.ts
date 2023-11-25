export const simpleIntrospection = {
  __schema: {
    queryType: {
      name: 'Query',
    },
    mutationType: {
      name: 'Mutation',
    },
    subscriptionType: {
      name: 'Subscription',
    },
    types: [
      {
        kind: 'INPUT_OBJECT',
        name: 'TodoPayload',
        description: null,
        fields: null,
        inputFields: [
          {
            name: 'title',
            description: null,
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
            },
            defaultValue: null,
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'complete',
            description: null,
            type: {
              kind: 'SCALAR',
              name: 'Boolean',
              ofType: null,
            },
            defaultValue: null,
            isDeprecated: false,
            deprecationReason: null,
          },
        ],
        interfaces: null,
        enumValues: null,
        possibleTypes: null,
      },
      {
        kind: 'OBJECT',
        name: 'Query',
        fields: [
          {
            name: 'todos',
            args: [],
            type: {
              kind: 'LIST',
              name: null,
              ofType: {
                kind: 'OBJECT',
                name: 'Todo',
                ofType: null,
              },
            },
          },
          {
            name: 'test',
            args: [],
            type: {
              kind: 'UNION',
              name: 'Search',
              ofType: null,
            },
          },
          {
            name: 'latestTodo',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'UNION',
                name: 'LatestTodoResult',
                ofType: null,
              },
            },
          },
        ],
        inputFields: null,
        interfaces: [],
        enumValues: null,
        possibleTypes: null,
      },
      {
        name: 'LatestTodoResult',
        kind: 'UNION',
        args: [],
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'Todo',
            ofType: null,
          },
          {
            kind: 'OBJECT',
            name: 'NoTodosError',
            ofType: null,
          },
        ],
      },
      {
        kind: 'OBJECT',
        name: 'NoTodosError',
        interfaces: [],
        fields: [
          {
            name: 'message',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
            },
            isDeprecated: false,
            deprecationReason: null,
          },
        ],
      },
      {
        kind: 'OBJECT',
        name: 'Todo',
        fields: [
          {
            name: 'id',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
            },
          },
          {
            name: 'text',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
            },
          },
          {
            name: 'complete',
            args: [],
            type: {
              kind: 'SCALAR',
              name: 'Boolean',
              ofType: null,
            },
          },
          {
            name: 'test',
            args: [],
            type: {
              kind: 'ENUM',
              name: 'test',
              ofType: null,
            },
          },
          {
            name: 'author',
            args: [],
            type: {
              kind: 'OBJECT',
              name: 'Author',
              ofType: null,
            },
          },
        ],
        inputFields: null,
        interfaces: [],
        enumValues: null,
        possibleTypes: null,
      },
      {
        kind: 'SCALAR',
        name: 'ID',
        fields: null,
        inputFields: null,
        interfaces: null,
        enumValues: null,
        possibleTypes: null,
      },
      {
        kind: 'SCALAR',
        name: 'String',
        fields: null,
        inputFields: null,
        interfaces: null,
        enumValues: null,
        possibleTypes: null,
      },
      {
        kind: 'SCALAR',
        name: 'Boolean',
        fields: null,
        inputFields: null,
        interfaces: null,
        enumValues: null,
        possibleTypes: null,
      },
      {
        kind: 'OBJECT',
        name: 'Author',
        fields: [
          {
            name: 'id',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
            },
          },
          {
            name: 'name',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
            },
          },
          {
            name: 'known',
            args: [],
            type: {
              kind: 'SCALAR',
              name: 'Boolean',
              ofType: null,
            },
          },
        ],
        inputFields: null,
        interfaces: [],
        enumValues: null,
        possibleTypes: null,
      },
      {
        kind: 'OBJECT',
        name: 'Mutation',
        fields: [
          {
            name: 'updateTodo',
            description: null,
            args: [
              {
                name: 'id',
                description: null,
                type: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'ID',
                    ofType: null,
                  },
                },
                defaultValue: null,
                isDeprecated: false,
                deprecationReason: null,
              },
              {
                name: 'input',
                description: null,
                type: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'INPUT_OBJECT',
                    name: 'TodoPayload',
                    ofType: null,
                  },
                },
                defaultValue: null,
                isDeprecated: false,
                deprecationReason: null,
              },
            ],
            type: {
              kind: 'SCALAR',
              name: 'Boolean',
              ofType: null,
            },
            isDeprecated: false,
            deprecationReason: null,
          },
          {
            name: 'toggleTodo',
            args: [
              {
                name: 'id',
                type: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'SCALAR',
                    name: 'ID',
                    ofType: null,
                  },
                },
              },
            ],
            type: {
              kind: 'OBJECT',
              name: 'Todo',
              ofType: null,
            },
          },
        ],
        inputFields: null,
        interfaces: [],
        enumValues: null,
        possibleTypes: null,
      },
      {
        kind: 'OBJECT',
        name: 'Subscription',
        fields: [
          {
            name: 'newTodo',
            args: [],
            type: {
              kind: 'OBJECT',
              name: 'Todo',
              ofType: null,
            },
            isDeprecated: false,
            deprecationReason: null,
          },
        ],
        inputFields: null,
        interfaces: [],
        enumValues: null,
        possibleTypes: null,
      },
      {
        kind: 'OBJECT',
        name: '__Schema',
        fields: [
          {
            name: 'types',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'OBJECT',
                    name: '__Type',
                    ofType: null,
                  },
                },
              },
            },
          },
          {
            name: 'queryType',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'OBJECT',
                name: '__Type',
                ofType: null,
              },
            },
          },
          {
            name: 'mutationType',
            args: [],
            type: {
              kind: 'OBJECT',
              name: '__Type',
              ofType: null,
            },
          },
          {
            name: 'subscriptionType',
            args: [],
            type: {
              kind: 'OBJECT',
              name: '__Type',
              ofType: null,
            },
          },
          {
            name: 'directives',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'OBJECT',
                    name: '__Directive',
                    ofType: null,
                  },
                },
              },
            },
          },
        ],
        inputFields: null,
        interfaces: [],
        enumValues: null,
        possibleTypes: null,
      },
      {
        kind: 'OBJECT',
        name: '__Type',
        fields: [
          {
            name: 'kind',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'ENUM',
                name: '__TypeKind',
                ofType: null,
              },
            },
          },
          {
            name: 'name',
            args: [],
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
          },
          {
            name: 'description',
            args: [],
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
          },
          {
            name: 'fields',
            args: [
              {
                name: 'includeDeprecated',
                type: {
                  kind: 'SCALAR',
                  name: 'Boolean',
                  ofType: null,
                },
              },
            ],
            type: {
              kind: 'LIST',
              name: null,
              ofType: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'OBJECT',
                  name: '__Field',
                  ofType: null,
                },
              },
            },
          },
          {
            name: 'interfaces',
            args: [],
            type: {
              kind: 'LIST',
              name: null,
              ofType: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'OBJECT',
                  name: '__Type',
                  ofType: null,
                },
              },
            },
          },
          {
            name: 'possibleTypes',
            args: [],
            type: {
              kind: 'LIST',
              name: null,
              ofType: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'OBJECT',
                  name: '__Type',
                  ofType: null,
                },
              },
            },
          },
          {
            name: 'enumValues',
            args: [
              {
                name: 'includeDeprecated',
                type: {
                  kind: 'SCALAR',
                  name: 'Boolean',
                  ofType: null,
                },
              },
            ],
            type: {
              kind: 'LIST',
              name: null,
              ofType: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'OBJECT',
                  name: '__EnumValue',
                  ofType: null,
                },
              },
            },
          },
          {
            name: 'inputFields',
            args: [],
            type: {
              kind: 'LIST',
              name: null,
              ofType: {
                kind: 'NON_NULL',
                name: null,
                ofType: {
                  kind: 'OBJECT',
                  name: '__InputValue',
                  ofType: null,
                },
              },
            },
          },
          {
            name: 'ofType',
            args: [],
            type: {
              kind: 'OBJECT',
              name: '__Type',
              ofType: null,
            },
          },
        ],
        inputFields: null,
        interfaces: [],
        enumValues: null,
        possibleTypes: null,
      },
      {
        kind: 'ENUM',
        name: 'test',
        fields: null,
        inputFields: null,
        interfaces: null,
        enumValues: [{ name: 'value' }, { name: 'more' }],
      },
      {
        kind: 'ENUM',
        name: '__TypeKind',
        fields: null,
        inputFields: null,
        interfaces: null,
        enumValues: [
          {
            name: 'SCALAR',
          },
          {
            name: 'OBJECT',
          },
          {
            name: 'INTERFACE',
          },
          {
            name: 'UNION',
          },
          {
            name: 'ENUM',
          },
          {
            name: 'INPUT_OBJECT',
          },
          {
            name: 'LIST',
          },
          {
            name: 'NON_NULL',
          },
        ],
        possibleTypes: null,
      },
      {
        kind: 'OBJECT',
        name: '__Field',
        fields: [
          {
            name: 'name',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
            },
          },
          {
            name: 'description',
            args: [],
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
          },
          {
            name: 'args',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'OBJECT',
                    name: '__InputValue',
                    ofType: null,
                  },
                },
              },
            },
          },
          {
            name: 'type',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'OBJECT',
                name: '__Type',
                ofType: null,
              },
            },
          },
          {
            name: 'isDeprecated',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
            },
          },
          {
            name: 'deprecationReason',
            args: [],
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
          },
        ],
        inputFields: null,
        interfaces: [],
        enumValues: null,
        possibleTypes: null,
      },
      {
        kind: 'OBJECT',
        name: '__InputValue',
        fields: [
          {
            name: 'name',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
            },
          },
          {
            name: 'description',
            args: [],
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
          },
          {
            name: 'type',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'OBJECT',
                name: '__Type',
                ofType: null,
              },
            },
          },
          {
            name: 'defaultValue',
            args: [],
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
          },
        ],
        inputFields: null,
        interfaces: [],
        enumValues: null,
        possibleTypes: null,
      },
      {
        kind: 'OBJECT',
        name: '__EnumValue',
        fields: [
          {
            name: 'name',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
            },
          },
          {
            name: 'description',
            args: [],
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
          },
          {
            name: 'isDeprecated',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'SCALAR',
                name: 'Boolean',
                ofType: null,
              },
            },
          },
          {
            name: 'deprecationReason',
            args: [],
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
          },
        ],
        inputFields: null,
        interfaces: [],
        enumValues: null,
        possibleTypes: null,
      },
      {
        kind: 'OBJECT',
        name: '__Directive',
        fields: [
          {
            name: 'name',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
            },
          },
          {
            name: 'description',
            args: [],
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
          },
          {
            name: 'locations',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'ENUM',
                    name: '__DirectiveLocation',
                    ofType: null,
                  },
                },
              },
            },
          },
          {
            name: 'args',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'LIST',
                name: null,
                ofType: {
                  kind: 'NON_NULL',
                  name: null,
                  ofType: {
                    kind: 'OBJECT',
                    name: '__InputValue',
                    ofType: null,
                  },
                },
              },
            },
          },
        ],
        inputFields: null,
        interfaces: [],
        enumValues: null,
        possibleTypes: null,
      },
      {
        kind: 'ENUM',
        name: '__DirectiveLocation',
        fields: null,
        inputFields: null,
        interfaces: null,
        enumValues: [
          {
            name: 'QUERY',
          },
          {
            name: 'MUTATION',
          },
          {
            name: 'SUBSCRIPTION',
          },
          {
            name: 'FIELD',
          },
          {
            name: 'FRAGMENT_DEFINITION',
          },
          {
            name: 'FRAGMENT_SPREAD',
          },
          {
            name: 'INLINE_FRAGMENT',
          },
          {
            name: 'VARIABLE_DEFINITION',
          },
          {
            name: 'SCHEMA',
          },
          {
            name: 'SCALAR',
          },
          {
            name: 'OBJECT',
          },
          {
            name: 'FIELD_DEFINITION',
          },
          {
            name: 'ARGUMENT_DEFINITION',
          },
          {
            name: 'INTERFACE',
          },
          {
            name: 'UNION',
          },
          {
            name: 'ENUM',
          },
          {
            name: 'ENUM_VALUE',
          },
          {
            name: 'INPUT_OBJECT',
          },
          {
            name: 'INPUT_FIELD_DEFINITION',
          },
        ],
        possibleTypes: null,
      },
      {
        kind: 'INTERFACE',
        name: 'ITodo',
        fields: [
          {
            name: 'id',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
            },
          },
          {
            name: 'text',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
            },
          },
          {
            name: 'complete',
            args: [],
            type: {
              kind: 'SCALAR',
              name: 'Boolean',
              ofType: null,
            },
          },
          {
            name: 'author',
            args: [],
            type: {
              kind: 'OBJECT',
              name: 'Author',
              ofType: null,
            },
          },
        ],
        inputFields: null,
        interfaces: null,
        enumValues: null,
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'BigTodo',
            ofType: null,
          },
          {
            kind: 'OBJECT',
            name: 'SmallTodo',
            ofType: null,
          },
        ],
      },
      {
        kind: 'OBJECT',
        name: 'BigTodo',
        inerfaces: ['Node'],
        fields: [
          {
            name: 'id',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
            },
          },
          {
            name: 'text',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
            },
          },
          {
            name: 'complete',
            args: [],
            type: {
              kind: 'SCALAR',
              name: 'Boolean',
              ofType: null,
            },
          },
          {
            name: 'author',
            args: [],
            type: {
              kind: 'OBJECT',
              name: 'Author',
              ofType: null,
            },
          },
          {
            name: 'wallOfText',
            args: [],
            type: {
              kind: 'SCALAR',
              name: 'String',
              ofType: null,
            },
          },
        ],
        inputFields: null,
        interfaces: [
          {
            kind: 'INTERFACE',
            name: 'ITodo',
            ofType: null,
          },
        ],
        enumValues: null,
        possibleTypes: null,
      },
      {
        kind: 'OBJECT',
        name: 'SmallTodo',
        fields: [
          {
            name: 'id',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'SCALAR',
                name: 'ID',
                ofType: null,
              },
            },
          },
          {
            name: 'text',
            args: [],
            type: {
              kind: 'NON_NULL',
              name: null,
              ofType: {
                kind: 'SCALAR',
                name: 'String',
                ofType: null,
              },
            },
          },
          {
            name: 'complete',
            args: [],
            type: {
              kind: 'SCALAR',
              name: 'Boolean',
              ofType: null,
            },
          },
          {
            name: 'author',
            args: [],
            type: {
              kind: 'OBJECT',
              name: 'Author',
              ofType: null,
            },
          },
          {
            name: 'maxLength',
            args: [],
            type: {
              kind: 'SCALAR',
              name: 'Int',
              ofType: null,
            },
          },
        ],
        inputFields: null,
        interfaces: [
          {
            kind: 'INTERFACE',
            name: 'ITodo',
            ofType: null,
          },
        ],
        enumValues: null,
        possibleTypes: null,
      },
      {
        kind: 'SCALAR',
        name: 'Int',
        fields: null,
        inputFields: null,
        interfaces: null,
        enumValues: null,
        possibleTypes: null,
      },
      {
        kind: 'ENUM',
        name: 'Todos',
        fields: null,
        inputFields: null,
        interfaces: null,
        enumValues: [
          {
            name: 'SmallTodo',
          },
          {
            name: 'BigTodo',
          },
        ],
        possibleTypes: null,
      },
      {
        kind: 'UNION',
        name: 'Search',
        fields: null,
        inputFields: null,
        interfaces: null,
        enumValues: null,
        possibleTypes: [
          {
            kind: 'OBJECT',
            name: 'SmallTodo',
            ofType: null,
          },
          {
            kind: 'OBJECT',
            name: 'BigTodo',
            ofType: null,
          },
        ],
      },
      {
        kind: 'ENUM',
        name: 'CacheControlScope',
        fields: null,
        inputFields: null,
        interfaces: null,
        enumValues: [
          {
            name: 'PUBLIC',
          },
          {
            name: 'PRIVATE',
          },
        ],
        possibleTypes: null,
      },
      {
        kind: 'SCALAR',
        name: 'Upload',
        fields: null,
        inputFields: null,
        interfaces: null,
        enumValues: null,
        possibleTypes: null,
      },
    ],
  },
} as const;
