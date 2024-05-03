export type simpleSchema = {
  name: 'simpleSchema';
  query: 'Query';
  mutation: 'Mutation';
  subscription: 'Subscription';
  types: {
    Author: {
      kind: 'OBJECT';
      name: 'Author';
      fields: {
        id: {
          name: 'id';
          type: {
            kind: 'NON_NULL';
            name: never;
            ofType: {
              kind: 'SCALAR';
              name: 'ID';
              ofType: null;
            };
          };
        };
        known: {
          name: 'known';
          type: {
            kind: 'SCALAR';
            name: 'Boolean';
            ofType: null;
          };
        };
        name: {
          name: 'name';
          type: {
            kind: 'NON_NULL';
            name: never;
            ofType: {
              kind: 'SCALAR';
              name: 'String';
              ofType: null;
            };
          };
        };
      };
    };
    BigTodo: {
      kind: 'OBJECT';
      name: 'BigTodo';
      fields: {
        author: {
          name: 'author';
          type: {
            kind: 'OBJECT';
            name: 'Author';
            ofType: null;
          };
        };
        complete: {
          name: 'complete';
          type: {
            kind: 'SCALAR';
            name: 'Boolean';
            ofType: null;
          };
        };
        id: {
          name: 'id';
          type: {
            kind: 'NON_NULL';
            name: never;
            ofType: {
              kind: 'SCALAR';
              name: 'ID';
              ofType: null;
            };
          };
        };
        text: {
          name: 'text';
          type: {
            kind: 'NON_NULL';
            name: never;
            ofType: {
              kind: 'SCALAR';
              name: 'String';
              ofType: null;
            };
          };
        };
        wallOfText: {
          name: 'wallOfText';
          type: {
            kind: 'SCALAR';
            name: 'String';
            ofType: null;
          };
        };
      };
    };
    Boolean: unknown;
    DefaultPayload: {
      kind: 'INPUT_OBJECT';
      name: 'DefaultPayload';
      isOneOf: false;
      inputFields: [
        {
          name: 'value';
          type: {
            kind: 'NON_NULL';
            name: never;
            ofType: {
              kind: 'SCALAR';
              name: 'String';
              ofType: null;
            };
          };
          defaultValue: 'DEFAULT';
        },
      ];
    };
    ID: unknown;
    ITodo: {
      kind: 'INTERFACE';
      name: 'ITodo';
      fields: {
        author: {
          name: 'author';
          type: {
            kind: 'OBJECT';
            name: 'Author';
            ofType: null;
          };
        };
        complete: {
          name: 'complete';
          type: {
            kind: 'SCALAR';
            name: 'Boolean';
            ofType: null;
          };
        };
        id: {
          name: 'id';
          type: {
            kind: 'NON_NULL';
            name: never;
            ofType: {
              kind: 'SCALAR';
              name: 'ID';
              ofType: null;
            };
          };
        };
        text: {
          name: 'text';
          type: {
            kind: 'NON_NULL';
            name: never;
            ofType: {
              kind: 'SCALAR';
              name: 'String';
              ofType: null;
            };
          };
        };
      };
      possibleTypes: 'BigTodo' | 'SmallTodo';
    };
    Int: unknown;
    LatestTodoResult: {
      kind: 'UNION';
      name: 'LatestTodoResult';
      fields: {};
      possibleTypes: 'NoTodosError' | 'Todo';
    };
    Mutation: {
      kind: 'OBJECT';
      name: 'Mutation';
      fields: {
        toggleTodo: {
          name: 'toggleTodo';
          type: {
            kind: 'OBJECT';
            name: 'Todo';
            ofType: null;
          };
        };
        updateTodo: {
          name: 'updateTodo';
          type: {
            kind: 'SCALAR';
            name: 'Boolean';
            ofType: null;
          };
        };
      };
    };
    NoTodosError: {
      kind: 'OBJECT';
      name: 'NoTodosError';
      fields: {
        message: {
          name: 'message';
          type: {
            kind: 'NON_NULL';
            name: never;
            ofType: {
              kind: 'SCALAR';
              name: 'String';
              ofType: null;
            };
          };
        };
      };
    };
    OneOfPayload: {
      kind: 'INPUT_OBJECT';
      name: 'OneOfPayload';
      isOneOf: true;
      inputFields: [
        {
          name: 'value_1';
          type: {
            kind: 'NON_NULL';
            name: never;
            ofType: {
              kind: 'SCALAR';
              name: 'String';
              ofType: null;
            };
          };
          defaultValue: null;
        },
        {
          name: 'value_2';
          type: {
            kind: 'NON_NULL';
            name: never;
            ofType: {
              kind: 'SCALAR';
              name: 'String';
              ofType: null;
            };
          };
          defaultValue: null;
        },
      ];
    };
    Query: {
      kind: 'OBJECT';
      name: 'Query';
      fields: {
        itodo: {
          name: 'itodo';
          type: {
            kind: 'NON_NULL';
            name: never;
            ofType: {
              kind: 'INTERFACE';
              name: 'ITodo';
              ofType: null;
            };
          };
        };
        latestTodo: {
          name: 'latestTodo';
          type: {
            kind: 'NON_NULL';
            name: never;
            ofType: {
              kind: 'UNION';
              name: 'LatestTodoResult';
              ofType: null;
            };
          };
        };
        test: {
          name: 'test';
          type: {
            kind: 'UNION';
            name: 'Search';
            ofType: null;
          };
        };
        todos: {
          name: 'todos';
          type: {
            kind: 'LIST';
            name: never;
            ofType: {
              kind: 'OBJECT';
              name: 'Todo';
              ofType: null;
            };
          };
        };
      };
    };
    Search: {
      kind: 'UNION';
      name: 'Search';
      fields: {};
      possibleTypes: 'BigTodo' | 'SmallTodo';
    };
    SmallTodo: {
      kind: 'OBJECT';
      name: 'SmallTodo';
      fields: {
        author: {
          name: 'author';
          type: {
            kind: 'OBJECT';
            name: 'Author';
            ofType: null;
          };
        };
        complete: {
          name: 'complete';
          type: {
            kind: 'SCALAR';
            name: 'Boolean';
            ofType: null;
          };
        };
        id: {
          name: 'id';
          type: {
            kind: 'NON_NULL';
            name: never;
            ofType: {
              kind: 'SCALAR';
              name: 'ID';
              ofType: null;
            };
          };
        };
        maxLength: {
          name: 'maxLength';
          type: {
            kind: 'SCALAR';
            name: 'Int';
            ofType: null;
          };
        };
        text: {
          name: 'text';
          type: {
            kind: 'NON_NULL';
            name: never;
            ofType: {
              kind: 'SCALAR';
              name: 'String';
              ofType: null;
            };
          };
        };
      };
    };
    String: unknown;
    Subscription: {
      kind: 'OBJECT';
      name: 'Subscription';
      fields: {
        newTodo: {
          name: 'newTodo';
          type: {
            kind: 'OBJECT';
            name: 'Todo';
            ofType: null;
          };
        };
      };
    };
    Todo: {
      kind: 'OBJECT';
      name: 'Todo';
      fields: {
        author: {
          name: 'author';
          type: {
            kind: 'OBJECT';
            name: 'Author';
            ofType: null;
          };
        };
        complete: {
          name: 'complete';
          type: {
            kind: 'SCALAR';
            name: 'Boolean';
            ofType: null;
          };
        };
        id: {
          name: 'id';
          type: {
            kind: 'NON_NULL';
            name: never;
            ofType: {
              kind: 'SCALAR';
              name: 'ID';
              ofType: null;
            };
          };
        };
        test: {
          name: 'test';
          type: {
            kind: 'ENUM';
            name: 'test';
            ofType: null;
          };
        };
        text: {
          name: 'text';
          type: {
            kind: 'NON_NULL';
            name: never;
            ofType: {
              kind: 'SCALAR';
              name: 'String';
              ofType: null;
            };
          };
        };
      };
    };
    TodoPayload: {
      kind: 'INPUT_OBJECT';
      name: 'TodoPayload';
      isOneOf: false;
      inputFields: [
        {
          name: 'title';
          type: {
            kind: 'NON_NULL';
            name: never;
            ofType: {
              kind: 'SCALAR';
              name: 'String';
              ofType: null;
            };
          };
          defaultValue: null;
        },
        {
          name: 'description';
          type: {
            kind: 'NON_NULL';
            name: never;
            ofType: {
              kind: 'SCALAR';
              name: 'String';
              ofType: null;
            };
          };
          defaultValue: null;
        },
        {
          name: 'complete';
          type: {
            kind: 'SCALAR';
            name: 'Boolean';
            ofType: null;
          };
          defaultValue: null;
        },
      ];
    };
    test: {
      name: 'test';
      enumValues: 'value' | 'more';
    };
  };
};
