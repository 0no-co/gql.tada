export type simpleSchema = {
  query: 'Query';
  mutation: 'Mutation';
  subscription: 'Subscription';

  types: {
    Query: {
      kind: 'OBJECT';
      name: 'Query';
      interfaces: never;
      fields: {
        todos: {
          name: 'todos';
          args: any;
          type: {
            kind: 'LIST';
            name: null;
            ofType: {
              kind: 'OBJECT';
              name: 'Todo';
              ofType: null;
            };
          };
        };
        latestTodo: {
          name: 'latestTodo';
          args: any;
          type: {
            kind: 'NON_NULL';
            name: null;
            ofType: {
              kind: 'UNION';
              name: 'LatestTodoResult';
              ofType: null;
            };
          };
        };
        test: {
          name: 'test';
          args: any;
          type: {
            kind: 'UNION';
            name: 'Search';
            ofType: null;
          };
        };
      };
    };

    Search: {
      kind: 'UNION';
      name: 'Search';
      fields: {};
      possibleTypes: 'SmallTodo' | 'BigTodo';
    };

    test: {
      kind: 'ENUM';
      name: 'test';
      type: 'value' | 'more';
    };

    SmallTodo: {
      kind: 'OBJECT';
      name: 'SmallTodo';
      fields: {
        id: {
          name: 'id';
          args: any;
          type: {
            kind: 'NON_NULL';
            name: null;
            ofType: {
              kind: 'SCALAR';
              name: 'ID';
              ofType: null;
            };
          };
        };
        text: {
          name: 'text';
          args: any;
          type: {
            kind: 'NON_NULL';
            name: null;
            ofType: {
              kind: 'SCALAR';
              name: 'String';
              ofType: null;
            };
          };
        };
        complete: {
          name: 'complete';
          args: any;
          type: {
            kind: 'SCALAR';
            name: 'Boolean';
            ofType: null;
          };
        };
        author: {
          name: 'author';
          args: any;
          type: {
            kind: 'OBJECT';
            name: 'Author';
            ofType: null;
          };
        };
        maxLength: {
          name: 'maxLength';
          args: any;
          type: {
            kind: 'SCALAR';
            name: 'Int';
            ofType: null;
          };
        };
      };
      interfaces: 'ITodo';
    };

    BigTodo: {
      kind: 'OBJECT';
      name: 'BigTodo';
      fields: {
        id: {
          name: 'id';
          args: any;
          type: {
            kind: 'NON_NULL';
            name: null;
            ofType: {
              kind: 'SCALAR';
              name: 'ID';
              ofType: null;
            };
          };
        };
        text: {
          name: 'text';
          args: any;
          type: {
            kind: 'NON_NULL';
            name: null;
            ofType: {
              kind: 'SCALAR';
              name: 'String';
              ofType: null;
            };
          };
        };
        complete: {
          name: 'complete';
          args: any;
          type: {
            kind: 'SCALAR';
            name: 'Boolean';
            ofType: null;
          };
        };
        author: {
          name: 'author';
          args: any;
          type: {
            kind: 'OBJECT';
            name: 'Author';
            ofType: null;
          };
        };
        wallOfText: {
          name: 'wallOfText';
          args: any;
          type: {
            kind: 'SCALAR';
            name: 'String';
            ofType: null;
          };
        };
      };
      interfaces: 'ITodo';
    };

    ITodo: {
      kind: 'INTERFACE';
      name: 'ITodo';
      interfaces: never;
      possibleTypes: 'BigTodo' | 'SmallTodo';
      fields: {
        id: {
          name: 'id';
          args: any;
          type: {
            kind: 'NON_NULL';
            name: null;
            ofType: {
              kind: 'SCALAR';
              name: 'ID';
              ofType: null;
            };
          };
        };
        text: {
          name: 'text';
          args: any;
          type: {
            kind: 'NON_NULL';
            name: null;
            ofType: {
              kind: 'SCALAR';
              name: 'String';
              ofType: null;
            };
          };
        };
        complete: {
          name: 'complete';
          args: any;
          type: {
            kind: 'SCALAR';
            name: 'Boolean';
            ofType: null;
          };
        };
        author: {
          name: 'author';
          args: any;
          type: {
            kind: 'OBJECT';
            name: 'Author';
            ofType: null;
          };
        };
      };
    };

    TodoPayload: {
      kind: 'INPUT_OBJECT';
      name: 'TodoPayload';
      inputFields: [
        {
          name: 'title';
          type: {
            kind: 'NON_NULL';
            name: null;
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

    LatestTodoResult: {
      kind: 'UNION';
      name: 'LatestTodoResult';
      fields: {};
      possibleTypes: 'Todo' | 'NoTodosError';
    };

    NoTodosError: {
      kind: 'OBJECT';
      name: 'NoTodosError';
      interfaces: never;
      fields: {
        message: {
          name: 'message';
          args: any;
          type: {
            kind: 'NON_NULL';
            name: null;
            ofType: {
              kind: 'SCALAR';
              name: 'String';
              ofType: null;
            };
          };
        };
      };
    };

    Todo: {
      kind: 'OBJECT';
      name: 'Todo';
      interfaces: never;
      fields: {
        id: {
          name: 'id';
          args: any;
          type: {
            kind: 'NON_NULL';
            name: null;
            ofType: {
              kind: 'SCALAR';
              name: 'ID';
              ofType: null;
            };
          };
        };
        text: {
          name: 'text';
          args: any;
          type: {
            kind: 'NON_NULL';
            name: null;
            ofType: {
              kind: 'SCALAR';
              name: 'String';
              ofType: null;
            };
          };
        };
        complete: {
          name: 'complete';
          args: any;
          type: {
            kind: 'SCALAR';
            name: 'Boolean';
            ofType: null;
          };
        };
        test: {
          name: 'test';
          args: any;
          type: {
            kind: 'ENUM';
            name: 'test';
            ofType: null;
          };
        };
        author: {
          name: 'author';
          args: any;
          type: {
            kind: 'OBJECT';
            name: 'Author';
            ofType: null;
          };
        };
      };
    };

    ID: {
      kind: 'SCALAR';
      type: string | number;
    };

    String: {
      kind: 'SCALAR';
      type: string;
    };

    Boolean: {
      kind: 'SCALAR';
      type: boolean;
    };

    Int: {
      kind: 'SCALAR';
      type: number;
    };

    Author: {
      kind: 'OBJECT';
      name: 'Author';
      interfaces: never;
      fields: {
        id: {
          name: 'id';
          args: any;
          type: {
            kind: 'NON_NULL';
            name: null;
            ofType: {
              kind: 'SCALAR';
              name: 'ID';
              ofType: null;
            };
          };
        };
        name: {
          name: 'name';
          args: any;
          type: {
            kind: 'NON_NULL';
            name: null;
            ofType: {
              kind: 'SCALAR';
              name: 'String';
              ofType: null;
            };
          };
        };
        known: {
          name: 'known';
          args: any;
          type: {
            kind: 'SCALAR';
            name: 'Boolean';
            ofType: null;
          };
        };
      };
    };

    Mutation: {
      kind: 'OBJECT';
      name: 'Mutation';
      interfaces: never;
      fields: {
        toggleTodo: {
          name: 'toggleTodo';
          args: any;
          type: {
            kind: 'OBJECT';
            name: 'Todo';
            ofType: null;
          };
        };
        updateTodo: {
          name: 'updateTodo';
          args: any;
          type: {
            kind: 'SCALAR';
            name: 'Boolean';
            ofType: null;
          };
        };
      };
    };

    Subscription: {
      kind: 'OBJECT';
      name: 'Subscription';
      interfaces: never;
      fields: {
        newTodo: {
          name: 'newTodo';
          args: any;
          type: {
            kind: 'OBJECT';
            name: 'Todo';
            ofType: null;
          };
        };
      };
    };
  };
};
