import { Kind, OperationTypeNode } from '@0no-co/graphql.web';

import type {
  SelectionSetNode,
  FragmentDefinitionNode,
  OperationDefinitionNode,
  FieldNode,
  DocumentNode,
} from '@0no-co/graphql.web';

/** Support matrix to be used in the {@link makeIntrospectionQuery} builder */
export interface SupportedFeatures {
  directiveIsRepeatable: boolean;
  specifiedByURL: boolean;
  inputValueDeprecation: boolean;
  directiveArgumentsIsDeprecated: boolean;
  fieldArgumentsIsDeprecated: boolean;
  inputOneOf: boolean;
}

/** Data from a {@link makeIntrospectSupportQuery} result */
export interface IntrospectSupportQueryData {
  directive: { fields: { name: string; args: { name: string }[] | null }[] | null } | null;
  type: { fields: { name: string }[] | null } | null;
  field: { fields: { name: string; args: { name: string }[] | null }[] | null } | null;
  inputValue: { fields: { name: string }[] | null } | null;
}

const _hasField = (
  data: IntrospectSupportQueryData[keyof IntrospectSupportQueryData],
  fieldName: string
): boolean => !!data && !!data.fields && data.fields.some((field) => field.name === fieldName);

const _supportsDeprecatedArgumentsArg = (
  data: IntrospectSupportQueryData['field' | 'directive']
): boolean => {
  const argsField = data && data.fields && data.fields.find((field) => field.name === 'args');
  return !!(
    argsField &&
    argsField.args &&
    argsField.args.find((arg) => arg.name === 'includeDeprecated')
  );
};

/** Evaluates data from a {@link makeIntrospectSupportQuery} result to {@link SupportedFeatures} */
export const toSupportedFeatures = (data: IntrospectSupportQueryData): SupportedFeatures => ({
  directiveIsRepeatable: _hasField(data.directive, 'isRepeatable'),
  specifiedByURL: _hasField(data.type, 'specifiedByURL'),
  inputValueDeprecation: _hasField(data.inputValue, 'isDeprecated'),
  directiveArgumentsIsDeprecated: _supportsDeprecatedArgumentsArg(data.directive),
  fieldArgumentsIsDeprecated: _supportsDeprecatedArgumentsArg(data.field),
  inputOneOf: _hasField(data.type, 'isOneOf'),
});

let _introspectionQuery: DocumentNode | undefined;
let _previousSupport: SupportedFeatures | undefined;
/** Builds an introspection query as AST */
export const makeIntrospectionQuery = (support: SupportedFeatures): DocumentNode => {
  if (_introspectionQuery && _previousSupport === support) {
    return _introspectionQuery;
  } else {
    return (_introspectionQuery = _makeIntrospectionQuery((_previousSupport = support)));
  }
};

const _makeIntrospectionQuery = (support: SupportedFeatures): DocumentNode => ({
  kind: Kind.DOCUMENT,
  definitions: [
    {
      kind: Kind.OPERATION_DEFINITION,
      name: { kind: Kind.NAME, value: 'IntrospectionQuery' },
      operation: OperationTypeNode.QUERY,
      selectionSet: {
        kind: Kind.SELECTION_SET,
        selections: [
          {
            kind: Kind.FIELD,
            name: { kind: Kind.NAME, value: '__schema' },
            selectionSet: _makeSchemaSelection(support),
          },
        ],
      },
    } satisfies OperationDefinitionNode,

    _makeSchemaFullTypeFragment(support),
    _makeSchemaInputValueFragment(support),
    _makeTypeRefFragment(),
  ],
});

/** Builds a support matrix query resulting in {@link IntrospectSupportQueryData} results */
export const makeIntrospectSupportQuery = (): DocumentNode => ({
  kind: Kind.DOCUMENT,
  definitions: [
    {
      kind: Kind.OPERATION_DEFINITION,
      name: { kind: Kind.NAME, value: 'IntrospectSupportQuery' },
      operation: OperationTypeNode.QUERY,
      selectionSet: {
        kind: Kind.SELECTION_SET,
        selections: [
          {
            kind: Kind.FIELD,
            alias: { kind: Kind.NAME, value: 'directive' },
            name: { kind: Kind.NAME, value: '__type' },
            arguments: [
              {
                kind: Kind.ARGUMENT,
                name: { kind: Kind.NAME, value: 'name' },
                value: { kind: Kind.STRING, value: '__Directive' },
              },
            ],
            selectionSet: _makeFieldNamesSelection({ includeArgs: true }),
          },
          {
            kind: Kind.FIELD,
            alias: { kind: Kind.NAME, value: 'field' },
            name: { kind: Kind.NAME, value: '__type' },
            arguments: [
              {
                kind: Kind.ARGUMENT,
                name: { kind: Kind.NAME, value: 'name' },
                value: { kind: Kind.STRING, value: '__Field' },
              },
            ],
            selectionSet: _makeFieldNamesSelection({ includeArgs: true }),
          },
          {
            kind: Kind.FIELD,
            alias: { kind: Kind.NAME, value: 'type' },
            name: { kind: Kind.NAME, value: '__type' },
            arguments: [
              {
                kind: Kind.ARGUMENT,
                name: { kind: Kind.NAME, value: 'name' },
                value: { kind: Kind.STRING, value: '__Type' },
              },
            ],
            selectionSet: _makeFieldNamesSelection({ includeArgs: false }),
          },
          {
            kind: Kind.FIELD,
            alias: { kind: Kind.NAME, value: 'inputValue' },
            name: { kind: Kind.NAME, value: '__type' },
            arguments: [
              {
                kind: Kind.ARGUMENT,
                name: { kind: Kind.NAME, value: 'name' },
                value: { kind: Kind.STRING, value: '__InputValue' },
              },
            ],
            selectionSet: _makeFieldNamesSelection({ includeArgs: false }),
          },
        ],
      },
    } satisfies OperationDefinitionNode,
  ],
});

const _makeFieldNamesSelection = (options: { includeArgs: boolean }): SelectionSetNode => ({
  kind: Kind.SELECTION_SET,
  selections: [
    {
      kind: Kind.FIELD,
      name: { kind: Kind.NAME, value: 'fields' },
      selectionSet: {
        kind: Kind.SELECTION_SET,
        selections: [
          {
            kind: Kind.FIELD,
            name: { kind: Kind.NAME, value: 'name' },
          },
          ...(options.includeArgs
            ? ([
                {
                  kind: Kind.FIELD,
                  name: { kind: Kind.NAME, value: 'args' },
                  selectionSet: {
                    kind: Kind.SELECTION_SET,
                    selections: [
                      {
                        kind: Kind.FIELD,
                        name: { kind: Kind.NAME, value: 'name' },
                      },
                    ],
                  },
                },
              ] as const)
            : []),
        ],
      },
    },
  ],
});

const _makeSchemaSelection = (support: SupportedFeatures): SelectionSetNode => ({
  kind: Kind.SELECTION_SET,
  selections: [
    // queryType { name }
    {
      kind: Kind.FIELD,
      name: { kind: Kind.NAME, value: 'queryType' },
      selectionSet: {
        kind: Kind.SELECTION_SET,
        selections: [
          {
            kind: Kind.FIELD,
            name: { kind: Kind.NAME, value: 'name' },
          },
        ],
      },
    },
    // mutationType { name }
    {
      kind: Kind.FIELD,
      name: { kind: Kind.NAME, value: 'mutationType' },
      selectionSet: {
        kind: Kind.SELECTION_SET,
        selections: [
          {
            kind: Kind.FIELD,
            name: { kind: Kind.NAME, value: 'name' },
          },
        ],
      },
    },
    // subscriptionType { name }
    {
      kind: Kind.FIELD,
      name: { kind: Kind.NAME, value: 'subscriptionType' },
      selectionSet: {
        kind: Kind.SELECTION_SET,
        selections: [
          {
            kind: Kind.FIELD,
            name: { kind: Kind.NAME, value: 'name' },
          },
        ],
      },
    },
    // types { ...FullType }
    {
      kind: Kind.FIELD,
      name: { kind: Kind.NAME, value: 'types' },
      selectionSet: {
        kind: Kind.SELECTION_SET,
        selections: [
          {
            kind: Kind.FRAGMENT_SPREAD,
            name: { kind: Kind.NAME, value: 'FullType' },
          },
        ],
      },
    },
    // directives { name description locations args }
    {
      kind: Kind.FIELD,
      name: { kind: Kind.NAME, value: 'directives' },
      selectionSet: {
        kind: Kind.SELECTION_SET,
        selections: [
          {
            kind: Kind.FIELD,
            name: { kind: Kind.NAME, value: 'name' },
          },
          {
            kind: Kind.FIELD,
            name: { kind: Kind.NAME, value: 'description' },
          },
          {
            kind: Kind.FIELD,
            name: { kind: Kind.NAME, value: 'locations' },
          },
          _makeSchemaArgsField(support.directiveArgumentsIsDeprecated),
          ...(support.directiveIsRepeatable
            ? ([
                {
                  kind: Kind.FIELD,
                  name: { kind: Kind.NAME, value: 'isRepeatable' },
                },
              ] as const)
            : []),
        ],
      },
    },
  ],
});

const _makeSchemaFullTypeFragment = (support: SupportedFeatures): FragmentDefinitionNode => ({
  kind: Kind.FRAGMENT_DEFINITION,
  name: { kind: Kind.NAME, value: 'FullType' },
  typeCondition: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: '__Type' } },
  selectionSet: {
    kind: Kind.SELECTION_SET,
    selections: [
      {
        kind: Kind.FIELD,
        name: { kind: Kind.NAME, value: 'kind' },
      },
      {
        kind: Kind.FIELD,
        name: { kind: Kind.NAME, value: 'name' },
      },
      {
        kind: Kind.FIELD,
        name: { kind: Kind.NAME, value: 'description' },
      },
      ...(support.specifiedByURL
        ? ([
            {
              kind: Kind.FIELD,
              name: { kind: Kind.NAME, value: 'specifiedByURL' },
            },
          ] as const)
        : []),
      {
        kind: Kind.FIELD,
        name: { kind: Kind.NAME, value: 'fields' },
        arguments: [
          {
            kind: Kind.ARGUMENT,
            name: { kind: Kind.NAME, value: 'includeDeprecated' },
            value: { kind: Kind.BOOLEAN, value: true },
          },
        ],
        selectionSet: {
          kind: Kind.SELECTION_SET,
          selections: [
            {
              kind: Kind.FIELD,
              name: { kind: Kind.NAME, value: 'name' },
            },
            {
              kind: Kind.FIELD,
              name: { kind: Kind.NAME, value: 'description' },
            },
            {
              kind: Kind.FIELD,
              name: { kind: Kind.NAME, value: 'isDeprecated' },
            },
            {
              kind: Kind.FIELD,
              name: { kind: Kind.NAME, value: 'deprecationReason' },
            },
            _makeSchemaArgsField(support.fieldArgumentsIsDeprecated),
            {
              kind: Kind.FIELD,
              name: { kind: Kind.NAME, value: 'type' },
              selectionSet: {
                kind: Kind.SELECTION_SET,
                selections: [
                  {
                    kind: Kind.FRAGMENT_SPREAD,
                    name: { kind: Kind.NAME, value: 'TypeRef' },
                  },
                ],
              },
            },
          ],
        },
      },
      {
        kind: Kind.FIELD,
        name: { kind: Kind.NAME, value: 'interfaces' },
        selectionSet: {
          kind: Kind.SELECTION_SET,
          selections: [
            {
              kind: Kind.FRAGMENT_SPREAD,
              name: { kind: Kind.NAME, value: 'TypeRef' },
            },
          ],
        },
      },
      {
        kind: Kind.FIELD,
        name: { kind: Kind.NAME, value: 'possibleTypes' },
        selectionSet: {
          kind: Kind.SELECTION_SET,
          selections: [
            {
              kind: Kind.FRAGMENT_SPREAD,
              name: { kind: Kind.NAME, value: 'TypeRef' },
            },
          ],
        },
      },
      {
        kind: Kind.FIELD,
        name: { kind: Kind.NAME, value: 'inputFields' },
        arguments: support.inputValueDeprecation
          ? [
              {
                kind: Kind.ARGUMENT,
                name: { kind: Kind.NAME, value: 'includeDeprecated' },
                value: { kind: Kind.BOOLEAN, value: true },
              },
            ]
          : [],
        selectionSet: {
          kind: Kind.SELECTION_SET,
          selections: [
            {
              kind: Kind.FRAGMENT_SPREAD,
              name: { kind: Kind.NAME, value: 'InputValue' },
            },
          ],
        },
      },
      {
        kind: Kind.FIELD,
        name: { kind: Kind.NAME, value: 'enumValues' },
        arguments: [
          {
            kind: Kind.ARGUMENT,
            name: { kind: Kind.NAME, value: 'includeDeprecated' },
            value: { kind: Kind.BOOLEAN, value: true },
          },
        ],
        selectionSet: {
          kind: Kind.SELECTION_SET,

          selections: [
            {
              kind: Kind.FIELD,
              name: { kind: Kind.NAME, value: 'name' },
            },
            {
              kind: Kind.FIELD,
              name: { kind: Kind.NAME, value: 'description' },
            },
            {
              kind: Kind.FIELD,
              name: { kind: Kind.NAME, value: 'isDeprecated' },
            },
            {
              kind: Kind.FIELD,
              name: { kind: Kind.NAME, value: 'deprecationReason' },
            },
          ],
        },
      },
    ],
  },
});

const _makeSchemaArgsField = (supportsValueDeprecation: boolean): FieldNode => ({
  kind: Kind.FIELD,
  name: { kind: Kind.NAME, value: 'args' },
  arguments: supportsValueDeprecation
    ? [
        {
          kind: Kind.ARGUMENT,
          name: { kind: Kind.NAME, value: 'includeDeprecated' },
          value: { kind: Kind.BOOLEAN, value: true },
        },
      ]
    : [],
  selectionSet: {
    kind: Kind.SELECTION_SET,
    selections: [
      {
        kind: Kind.FRAGMENT_SPREAD,
        name: { kind: Kind.NAME, value: 'InputValue' },
      },
    ],
  },
});

const _makeSchemaInputValueFragment = (support: SupportedFeatures): FragmentDefinitionNode => ({
  kind: Kind.FRAGMENT_DEFINITION,
  name: { kind: Kind.NAME, value: 'InputValue' },
  typeCondition: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: '__InputValue' } },
  selectionSet: {
    kind: Kind.SELECTION_SET,
    selections: [
      {
        kind: Kind.FIELD,
        name: { kind: Kind.NAME, value: 'name' },
      },
      {
        kind: Kind.FIELD,
        name: { kind: Kind.NAME, value: 'description' },
      },
      {
        kind: Kind.FIELD,
        name: { kind: Kind.NAME, value: 'defaultValue' },
      },
      {
        kind: Kind.FIELD,
        name: { kind: Kind.NAME, value: 'type' },
        selectionSet: {
          kind: Kind.SELECTION_SET,
          selections: [
            {
              kind: Kind.FRAGMENT_SPREAD,
              name: { kind: Kind.NAME, value: 'TypeRef' },
            },
          ],
        },
      },
      ...(support.inputValueDeprecation
        ? ([
            {
              kind: Kind.FIELD,
              name: { kind: Kind.NAME, value: 'isDeprecated' },
            },
            {
              kind: Kind.FIELD,
              name: { kind: Kind.NAME, value: 'deprecationReason' },
            },
          ] as const)
        : []),
    ],
  },
});

const _makeTypeRefFragment = (): FragmentDefinitionNode => ({
  kind: Kind.FRAGMENT_DEFINITION,
  name: { kind: Kind.NAME, value: 'TypeRef' },
  typeCondition: { kind: Kind.NAMED_TYPE, name: { kind: Kind.NAME, value: '__Type' } },
  selectionSet: _makeTypeRefSelection(0),
});

const _makeTypeRefSelection = (depth: number): SelectionSetNode => ({
  kind: Kind.SELECTION_SET,
  selections:
    depth < 9
      ? [
          {
            kind: Kind.FIELD,
            name: { kind: Kind.NAME, value: 'kind' },
          },
          {
            kind: Kind.FIELD,
            name: { kind: Kind.NAME, value: 'name' },
          },
          {
            kind: Kind.FIELD,
            name: { kind: Kind.NAME, value: 'ofType' },
            selectionSet: _makeTypeRefSelection(depth + 1),
          },
        ]
      : [
          {
            kind: Kind.FIELD,
            name: { kind: Kind.NAME, value: 'kind' },
          },
          {
            kind: Kind.FIELD,
            name: { kind: Kind.NAME, value: 'name' },
          },
        ],
});
