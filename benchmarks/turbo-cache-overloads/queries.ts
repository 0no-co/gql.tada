import { initGraphQLTada } from 'gql.tada';
import type { introspection } from './graphql-env.d.ts';

const graphql = initGraphQLTada<{ introspection: introspection }>();

const q01 = graphql(`
  query Q01($id: ID!) {
    node(id: $id) {
      id
      name
      labels {
        id
        key
        value
      }
    }
  }
`);
const q02 = graphql(`
  query Q02($id: ID!) {
    node(id: $id) {
      id
      name
    }
  }
`);
const q03 = graphql(`
  query Q03($id: ID!) {
    node(id: $id) {
      id
      labels {
        id
      }
    }
  }
`);
const q04 = graphql(`
  query Q04($id: ID!) {
    node(id: $id) {
      name
    }
  }
`);
const q05 = graphql(`
  query Q05($id: ID!) {
    node(id: $id) {
      id
      labels {
        key
        value
      }
    }
  }
`);
const q06 = graphql(`
  query Q06($id: ID!) {
    item(id: $id) {
      id
      name
    }
  }
`);
const q07 = graphql(`
  query Q07($id: ID!) {
    item(id: $id) {
      id
    }
  }
`);
const q08 = graphql(`
  query Q08($id: ID!) {
    item(id: $id) {
      name
    }
  }
`);
const q09 = graphql(`
  query Q09($id: ID!) {
    node(id: $id) {
      id
      name
      labels {
        id
        key
      }
    }
  }
`);
const q10 = graphql(`
  query Q10($id: ID!) {
    node(id: $id) {
      id
      labels {
        value
      }
    }
  }
`);
