import { Kind, OperationDefinitionNode, VariableDefinitionNode } from '@0no-co/graphql.web';
import { schema } from '../__tests__/introspection.test-d';
import { Introspection } from '../introspection';

type VariablesContinue<
  Variables extends readonly VariableDefinitionNode[],
  I extends Introspection<typeof schema>
> = never;

type DefinitionContinue<
  T extends any[],
  I extends Introspection<typeof schema>
> = (T[0] extends OperationDefinitionNode
  ? T[0]['variableDefinitions'] extends readonly VariableDefinitionNode[]
    ? VariablesContinue<T[0]['variableDefinitions'], I>
    : {}
  : {}) &
  (T extends readonly []
    ? {}
    : T extends readonly [any, ...infer Rest]
    ? DefinitionContinue<Rest, I>
    : {});

export type Variables<
  D extends { kind: Kind.DOCUMENT; definitions: any[] },
  I extends Introspection<typeof schema>
> = DefinitionContinue<D['definitions'], I>;
