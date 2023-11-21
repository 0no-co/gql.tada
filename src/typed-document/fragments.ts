import type { FragmentDefinitionNode, Kind } from '@0no-co/graphql.web';
import type { Selection, ObjectLikeType, FragmentMap } from './index';
import type { Introspection as IntrospectionType } from '../introspection';

export type FragmentType<
  Document extends { kind: Kind.DOCUMENT; definitions: any[] },
  Introspection extends IntrospectionType<any>,
  Fragments extends Record<string, FragmentDefinitionNode> = FragmentMap<Document>
> = Document['definitions'][0] extends {
  kind: Kind.FRAGMENT_DEFINITION;
  typeCondition: { name: { value: infer TypeName } };
}
  ? TypeName extends keyof Introspection['types']
    ? Introspection['types'][TypeName] extends ObjectLikeType
      ? Selection<
          Document['definitions'][0]['selectionSet']['selections'],
          Introspection['types'][TypeName],
          Introspection,
          Fragments
        >
      : never
    : never
  : never;
