import { initGraphQLTada, type ResultOf } from '../../src/index';
import type { simpleIntrospection } from '../../src/__tests__/fixtures/simpleIntrospection';

const graphql = initGraphQLTada<{ introspection: simpleIntrospection }>();
const staticFields = 'id text' as const;

const Todos = graphql(`
  query Todos {
    todos {
      ${staticFields}
    }
  }
`);

type TodosResult = ResultOf<typeof Todos>;

const validResult: TodosResult = {
  todos: [{ id: '1', text: 'native API' }],
};

const invalidResult: TodosResult = {
  todos: [{ id: '1', text: 1 }],
};

export { invalidResult, validResult };
