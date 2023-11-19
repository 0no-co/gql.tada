import { IntrospectionQuery, Introspection } from './introspection';
import { Document } from './parser';
import { TypedDocument } from './typed-document';
import { Variables } from './typed-document/variables';
import { schema } from './__tests__/introspection.test-d';
import { DocumentNode, parse } from '@0no-co/graphql.web';

interface DocumentTypeDecoration<TResult, TVariables> {
  /**
   * This type is used to ensure that the variables you pass in to the query are assignable to Variables
   * and that the Result is assignable to whatever you pass your result to. The method is never actually
   * implemented, but the type is valid because we list it as optional
   */
  __apiType?: (variables: TVariables) => TResult;
}

interface TypedDocumentNode<Result, Variables>
  extends DocumentNode,
    DocumentTypeDecoration<Result, Variables> {}

export const createGql = <Q extends IntrospectionQuery, Intro = Introspection<Q>>() => {
  return <
    Doc extends string,
    Parsed extends Document<Doc>,
    // TODO: how to handle void here
    Result extends TypedDocument<Parsed, Intro>,
    Vars extends Variables<Parsed, Intro> // TODO: how  to return this
  >(
    document: Doc
  ): TypedDocumentNode<Result, Vars> => {
    return parse(document);
  };
};

const gql = createGql<typeof schema>();

const fragment = `
  fragment X on Todo {
    id
    text
  }
`;

// TODO: find way to flatten the fragment in here
const result = gql(`
  query {
    todos {
      id
      ...X
    }
  }

  ${fragment}
`);

const mutationResult = gql(`
  mutation ($id: ID!) {
    toggleTodo { id }
  }
`);
