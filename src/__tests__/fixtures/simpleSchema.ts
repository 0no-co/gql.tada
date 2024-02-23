export type simpleSchema = {
  query: 'Query';
  mutation: 'Mutation';
  subscription: 'Subscription';

  types: {
    Query: {
      kind: 'OBJECT';
      name: 'Query';
      fields: {
        todos: {
          name: 'todos';
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
          type: {
            kind: 'SCALAR';
            name: 'Boolean';
            ofType: null;
          };
        };
        author: {
          name: 'author';
          type: {
            kind: 'OBJECT';
            name: 'Author';
            ofType: null;
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
      };
    };

    BigTodo: {
      kind: 'OBJECT';
      name: 'BigTodo';
      fields: {
        id: {
          name: 'id';
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
          type: {
            kind: 'SCALAR';
            name: 'Boolean';
            ofType: null;
          };
        };
        author: {
          name: 'author';
          type: {
            kind: 'OBJECT';
            name: 'Author';
            ofType: null;
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

    ITodo: {
      kind: 'INTERFACE';
      name: 'ITodo';
      possibleTypes: 'BigTodo' | 'SmallTodo';
      fields: {
        id: {
          name: 'id';
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
          type: {
            kind: 'SCALAR';
            name: 'Boolean';
            ofType: null;
          };
        };
        author: {
          name: 'author';
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

    DefaultPayload: {
      kind: 'INPUT_OBJECT';
      name: 'DefaultPayload';
      inputFields: [
        {
          name: 'value';
          type: {
            kind: 'NON_NULL';
            name: null;
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

    LatestTodoResult: {
      kind: 'UNION';
      name: 'LatestTodoResult';
      fields: {};
      possibleTypes: 'Todo' | 'NoTodosError';
    };

    NoTodosError: {
      kind: 'OBJECT';
      name: 'NoTodosError';
      fields: {
        message: {
          name: 'message';
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
      fields: {
        id: {
          name: 'id';
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
          type: {
            kind: 'SCALAR';
            name: 'Boolean';
            ofType: null;
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
        author: {
          name: 'author';
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
      name: 'ID';
      type: string | number;
    };

    String: {
      kind: 'SCALAR';
      name: 'String';
      type: string;
    };

    Boolean: {
      kind: 'SCALAR';
      name: 'Boolean';
      type: boolean;
    };

    Int: {
      kind: 'SCALAR';
      name: 'Int';
      type: number;
    };

    Author: {
      kind: 'OBJECT';
      name: 'Author';
      fields: {
        id: {
          name: 'id';
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
  };
};
