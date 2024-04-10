import type {
  IntrospectionQuery,
  IntrospectionType,
  IntrospectionEnumValue,
  IntrospectionInputValue,
  IntrospectionTypeRef,
  IntrospectionNamedTypeRef,
  IntrospectionField,
} from 'graphql';

const printName = (input: string | undefined | null): string => (input ? `'${input}'` : 'never');

const printTypeRef = (typeRef: IntrospectionTypeRef) => {
  if (typeRef.kind === 'NON_NULL') {
    return `{ kind: 'NON_NULL'; name: never; ofType: ${printTypeRef(typeRef.ofType)}; }`;
  } else if (typeRef.kind === 'LIST') {
    return `{ kind: 'LIST'; name: never; ofType: ${printTypeRef(typeRef.ofType)}; }`;
  } else {
    return `{ kind: ${printName(typeRef.kind)}; name: ${printName(typeRef.name)}; ofType: null; }`;
  }
};

const printInputFields = (inputFields: readonly IntrospectionInputValue[]) => {
  let output = '';
  for (const inputField of inputFields) {
    if (output) output += ', ';
    const name = printName(inputField.name);
    const type = printTypeRef(inputField.type);
    const defaultValue = inputField.defaultValue ? JSON.stringify(inputField.defaultValue) : 'null';
    output += `{ name: ${name}; type: ${type}; defaultValue: ${defaultValue} }`;
  }
  return `[${output}]`;
};

const printNamedTypes = (
  values: readonly (IntrospectionEnumValue | IntrospectionNamedTypeRef)[]
) => {
  if (!values.length) return 'never';
  let output = '';
  for (const value of values) {
    if (output) output += ' | ';
    output += printName(value.name);
  }
  return output;
};

const printFields = (fields: readonly IntrospectionField[]) => {
  let output = '';
  for (const field of fields) {
    const name = printName(field.name);
    const type = printTypeRef(field.type);
    output += `${printName(field.name)}: { name: ${name}; type: ${type} }; `;
  }
  return `{ ${output}}`;
};

export const printIntrospectionType = (type: IntrospectionType) => {
  if (type.kind === 'ENUM') {
    const values = printNamedTypes(type.enumValues);
    return `{ name: ${printName(type.name)}; enumValues: ${values}; }`;
  } else if (type.kind === 'INPUT_OBJECT') {
    const fields = printInputFields(type.inputFields);
    return `{ kind: 'INPUT_OBJECT'; name: ${printName(type.name)}; inputFields: ${fields}; }`;
  } else if (type.kind === 'OBJECT') {
    const fields = printFields(type.fields);
    return `{ kind: 'OBJECT'; name: ${printName(type.name)}; fields: ${fields}; }`;
  } else if (type.kind === 'INTERFACE') {
    const name = printName(type.name);
    const fields = printFields(type.fields);
    const possibleTypes = printNamedTypes(type.possibleTypes);
    return `{ kind: 'INTERFACE'; name: ${name}; fields: ${fields}; possibleTypes: ${possibleTypes}; }`;
  } else if (type.kind === 'UNION') {
    const name = printName(type.name);
    const possibleTypes = printNamedTypes(type.possibleTypes);
    return `{ kind: 'UNION'; name: ${name}; fields: {}; possibleTypes: ${possibleTypes}; }`;
  } else {
    return 'unknown';
  }
};

export function preprocessIntrospection({ __schema: schema }: IntrospectionQuery): string {
  const queryName = printName(schema.queryType.name);
  const mutationName = printName(schema.mutationType && schema.mutationType.name);
  const subscriptionName = printName(schema.subscriptionType && schema.subscriptionType.name);

  let evaluatedTypes = '';
  for (const type of schema.types) {
    const typeStr = printIntrospectionType(type);
    if (evaluatedTypes) evaluatedTypes += '\n';
    evaluatedTypes += `    ${printName(type.name)}: ${typeStr};`;
  }

  return (
    '{\n' +
    `  query: ${queryName};\n` +
    `  mutation: ${mutationName};\n` +
    `  subscription: ${subscriptionName};\n` +
    `  types: {\n${evaluatedTypes}\n  };\n}`
  );
}
