import type { IntrospectionQuery, IntrospectionType } from 'graphql';

const stringifyName = (input: string | undefined | null): string =>
  input ? `"${input}"` : 'never';

const stringifyDeepObjectType = (object: Record<string, unknown>) => {
  let output = '';
  for (const key in object) {
    let value = 'unknown';
    if (object[key] == null) {
      value = 'null';
    } else if (typeof object[key] === 'string') {
      value = JSON.stringify(object[key] as string);
    } else if (typeof object[key] === 'object') {
      value = stringifyDeepObjectType(object[key] as Record<string, unknown>);
    }
    output += `${stringifyName(key)}: ${value}; `;
  }
  return `{ ${output}}`;
};

const stringifyObjectType = (object: Record<string, string>) => {
  let output = '';
  for (const key in object) output += `${stringifyName(key)}: ${object[key]}; `;
  return `{ ${output}}`;
};

const stringifyTupleType = (tuple: Array<Record<string, unknown>>) => {
  let output = '';
  for (const value of tuple) {
    if (output) output += ', ';
    output += `${stringifyDeepObjectType(value)}`;
  }
  return `[ ${output}]`;
};

export const printIntrospectionType = (type: IntrospectionType) => {
  if (type.kind === 'ENUM') {
    return stringifyObjectType({
      kind: stringifyName(type.kind),
      name: stringifyName(type.name),
      type: type.enumValues.map((value) => stringifyName(value.name)).join(' | '),
    });
  } else if (type.kind === 'INPUT_OBJECT') {
    return stringifyObjectType({
      kind: stringifyName(type.kind),
      name: stringifyName(type.name),
      inputFields: stringifyTupleType(type.inputFields as any),
    });
  } else if (type.kind === 'OBJECT') {
    return stringifyObjectType({
      kind: stringifyName(type.kind),
      name: stringifyName(type.name),
      fields: stringifyObjectType(
        type.fields.reduce((object, field) => {
          object[field.name] = stringifyObjectType({
            name: stringifyName(field.name),
            type: stringifyDeepObjectType(field.type as any),
          });
          return object;
        }, {})
      ),
    });
  } else if (type.kind === 'INTERFACE') {
    return stringifyObjectType({
      kind: stringifyName(type.kind),
      name: stringifyName(type.name),
      possibleTypes: type.possibleTypes.map((value) => stringifyName(value.name)).join(' | '),
      fields: stringifyObjectType(
        type.fields.reduce((object, field) => {
          object[field.name] = stringifyObjectType({
            name: stringifyName(field.name),
            type: stringifyDeepObjectType(field.type as any),
          });
          return object;
        }, {})
      ),
    });
  } else if (type.kind === 'UNION') {
    return stringifyObjectType({
      kind: stringifyName(type.kind),
      name: stringifyName(type.name),
      possibleTypes: type.possibleTypes.map((value) => stringifyName(value.name)).join(' | '),
      fields: '{}',
    });
  } else if (type.kind === 'SCALAR') {
    return 'unknown';
  } else {
    return 'never';
  }
};

export function preprocessIntrospection({ __schema: schema }: IntrospectionQuery): string {
  const queryName = stringifyName(schema.queryType.name);
  const mutationName = stringifyName(schema.mutationType && schema.mutationType.name);
  const subscriptionName = stringifyName(schema.subscriptionType && schema.subscriptionType.name);

  let evaluatedTypes = '';
  for (const type of schema.types) {
    const typeStr = printIntrospectionType(type);
    evaluatedTypes += `    ${stringifyName(type.name)}: ${typeStr};\n`;
  }

  return (
    '{\n' +
    `  query: ${queryName};\n` +
    `  mutation: ${mutationName};\n` +
    `  subscription: ${subscriptionName};\n` +
    `  types: {\n${evaluatedTypes}  };\n}`
  );
}
