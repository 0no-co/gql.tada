import type {
  IntrospectionQuery,
  IntrospectionType,
  IntrospectionTypeRef,
  IntrospectionNamedTypeRef,
  IntrospectionOutputTypeRef,
  IntrospectionInputTypeRef,
  IntrospectionInputValue,
  IntrospectionEnumValue,
  IntrospectionField,
} from 'graphql';

function nameCompare(objA: { name: string }, objB: { name: string }) {
  return objA.name < objB.name ? -1 : objA.name > objB.name ? 1 : 0;
}

function mapTypeRef<const T extends IntrospectionTypeRef>(fromType: T): T;
function mapTypeRef(fromType: IntrospectionTypeRef): IntrospectionTypeRef;
function mapTypeRef(fromType: IntrospectionOutputTypeRef): IntrospectionOutputTypeRef;
function mapTypeRef(fromType: IntrospectionInputTypeRef): IntrospectionInputTypeRef;

function mapTypeRef(fromType: IntrospectionTypeRef): IntrospectionTypeRef {
  switch (fromType.kind) {
    case 'NON_NULL':
      return {
        kind: fromType.kind,
        ofType: mapTypeRef(fromType.ofType),
      };
    case 'LIST':
      return {
        kind: fromType.kind,
        ofType: mapTypeRef(fromType.ofType),
      };
    case 'ENUM':
    case 'INPUT_OBJECT':
    case 'SCALAR':
    case 'OBJECT':
    case 'INTERFACE':
    case 'UNION':
      return {
        kind: fromType.kind,
        name: fromType.name,
      };
  }
}

function mapEnumValue(value: IntrospectionEnumValue): IntrospectionEnumValue {
  return {
    name: value.name,
    isDeprecated: !!value.isDeprecated,
    deprecationReason: undefined,
  };
}

function mapInputField(value: IntrospectionInputValue): IntrospectionInputValue {
  return {
    name: value.name,
    type: mapTypeRef(value.type),
    defaultValue: value.defaultValue || undefined,
  };
}

function mapField(field: IntrospectionField): IntrospectionField {
  return {
    name: field.name,
    type: mapTypeRef(field.type),
    args: field.args ? field.args.map(mapInputField).sort(nameCompare) : [],
    isDeprecated: !!field.isDeprecated,
    deprecationReason: undefined,
  };
}

function mapPossibleType<T extends IntrospectionNamedTypeRef>(ref: T): T {
  return {
    kind: ref.kind,
    name: ref.name,
  } as T;
}

function minifyIntrospectionType(type: IntrospectionType): IntrospectionType {
  switch (type.kind) {
    case 'SCALAR':
      return {
        kind: 'SCALAR',
        name: type.name,
      };

    case 'ENUM':
      return {
        kind: 'ENUM',
        name: type.name,
        enumValues: type.enumValues.map(mapEnumValue),
      };

    case 'INPUT_OBJECT': {
      return {
        kind: 'INPUT_OBJECT',
        name: type.name,
        inputFields: type.inputFields.map(mapInputField),
      };
    }

    case 'OBJECT':
      return {
        kind: 'OBJECT',
        name: type.name,
        fields: type.fields ? type.fields.map(mapField).sort(nameCompare) : [],
        interfaces: type.interfaces ? type.interfaces.map(mapPossibleType).sort(nameCompare) : [],
      };

    case 'INTERFACE':
      return {
        kind: 'INTERFACE',
        name: type.name,
        fields: type.fields ? type.fields.map(mapField).sort(nameCompare) : [],
        interfaces: type.interfaces ? type.interfaces.map(mapPossibleType).sort(nameCompare) : [],
        possibleTypes: type.possibleTypes
          ? type.possibleTypes.map(mapPossibleType).sort(nameCompare)
          : [],
      };

    case 'UNION':
      return {
        kind: 'UNION',
        name: type.name,
        possibleTypes: type.possibleTypes
          ? type.possibleTypes.map(mapPossibleType).sort(nameCompare)
          : [],
      };
  }
}

/** Minifies an {@link IntrospectionQuery} for use with Graphcache or the `populateExchange`.
 *
 * @param schema - An {@link IntrospectionQuery} object to be minified.
 * @param opts - An optional {@link MinifySchemaOptions} configuration object.
 * @returns the minified {@link IntrospectionQuery} object.
 *
 * @remarks
 * `minifyIntrospectionQuery` reduces the size of an {@link IntrospectionQuery} by
 * removing data and information that a client-side consumer, like Graphcache or the
 * `populateExchange`, may not require.
 *
 * At the very least, it will remove system types, descriptions, depreactions,
 * and source locations. Unless disabled via the options passed, it will also
 * by default remove all scalars, enums, inputs, and directives.
 *
 * @throws
 * If `schema` receives an object that isn’t an {@link IntrospectionQuery}, a
 * {@link TypeError} will be thrown.
 */
export const minifyIntrospectionQuery = (schema: IntrospectionQuery): IntrospectionQuery => {
  if (!schema || !('__schema' in schema)) {
    throw new TypeError('Expected to receive an IntrospectionQuery.');
  }

  const {
    __schema: { queryType, mutationType, subscriptionType, types },
  } = schema;

  const minifiedTypes = types
    .filter((type) => {
      switch (type.name) {
        case '__Directive':
        case '__DirectiveLocation':
        case '__EnumValue':
        case '__InputValue':
        case '__Field':
        case '__Type':
        case '__TypeKind':
        case '__Schema':
          return false;
        default:
          return (
            type.kind === 'SCALAR' ||
            type.kind === 'ENUM' ||
            type.kind === 'INPUT_OBJECT' ||
            type.kind === 'OBJECT' ||
            type.kind === 'INTERFACE' ||
            type.kind === 'UNION'
          );
      }
    })
    .map(minifyIntrospectionType)
    .sort(nameCompare);

  return {
    __schema: {
      queryType: {
        kind: queryType.kind,
        name: queryType.name,
      },
      mutationType: mutationType
        ? {
            kind: mutationType.kind,
            name: mutationType.name,
          }
        : null,
      subscriptionType: subscriptionType
        ? {
            kind: subscriptionType.kind,
            name: subscriptionType.name,
          }
        : null,
      types: minifiedTypes,
      directives: [],
    },
  };
};
