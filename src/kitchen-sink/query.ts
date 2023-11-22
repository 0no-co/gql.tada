import { TypedDocument } from '../typed-document';
import { Document } from '../parser';
import { GitHubIntrospection } from './index';

const repositories = /* GraphQL */ `
  query ($org: String!, $repo: String!) {
    repository(owner: $org, name: $repo) {
      id
    }
  }
`;

const x: TypedDocument<Document<typeof repositories>, GitHubIntrospection> = {} as any;
x.repository;
