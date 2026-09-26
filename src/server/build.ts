import type {
  GraphQLNamedType,
  GraphQLType,
  GraphQLFieldConfigMap,
  GraphQLFieldConfigArgumentMap,
  GraphQLInputFieldConfigMap,
  GraphQLEnumValueConfigMap,
  DirectiveLocation,
} from 'graphql';

import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLEnumType,
  GraphQLScalarType,
  GraphQLInputObjectType,
  GraphQLNonNull,
  GraphQLList,
  GraphQLDirective,
  GraphQLID,
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  specifiedDirectives,
  assertValidSchema,
  getNamedType as unwrapNamedType,
  isInputObjectType,
  isEnumType,
} from 'graphql';

interface Ref {
  readonly kind: string;
  readonly name?: string;
  readonly ofType?: Ref;
  readonly '~config'?: any;
}

interface Applied {
  readonly directive: Ref & { readonly name: string };
  readonly args: { readonly [name: string]: unknown };
}

/** Applied directives, as they're exposed on `extensions.directives` */
type AppliedDirectives = { name: string; args: { [name: string]: unknown } }[];

type Extensions = { [key: string]: unknown };

interface BuildConfig {
  description?: string;
  query: Ref;
  mutation?: Ref;
  subscription?: Ref;
  types?: readonly Ref[];
  directives?: readonly Ref[];
  schemaDirectives?: readonly Applied[];
  assumeValid?: boolean;
  extensions?: Extensions;
}

const builtinScalars = new Map<string, GraphQLNamedType>([
  ['ID', GraphQLID],
  ['String', GraphQLString],
  ['Int', GraphQLInt],
  ['Float', GraphQLFloat],
  ['Boolean', GraphQLBoolean],
]);

const directiveLocations = [
  'QUERY',
  'MUTATION',
  'SUBSCRIPTION',
  'FIELD',
  'FRAGMENT_DEFINITION',
  'FRAGMENT_SPREAD',
  'INLINE_FRAGMENT',
  'VARIABLE_DEFINITION',
  'SCHEMA',
  'SCALAR',
  'OBJECT',
  'FIELD_DEFINITION',
  'ARGUMENT_DEFINITION',
  'INTERFACE',
  'UNION',
  'ENUM',
  'ENUM_VALUE',
  'INPUT_OBJECT',
  'INPUT_FIELD_DEFINITION',
];

// NOTE: Names may collide with `Object.prototype`'s properties (e.g. `constructor`), so all
// lookups on user-provided objects must only check their own properties
const hasOwn = (object: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(object, key);

const resolveThunk = <T>(value: T | (() => T)): T =>
  typeof value === 'function' ? (value as () => T)() : value;

const isInputValueConfig = (value: any): boolean =>
  !!value && typeof value === 'object' && hasOwn(value, 'type') && !hasOwn(value, 'kind');

const circularHint = ' This may be caused by a circular import.';

/** Returns a config value that at most one of a type's definitions may set */
function pickOne(configs: readonly any[], key: string, typeName: string): any {
  let value: unknown;
  for (const config of configs) {
    if (hasOwn(config, key) && config[key] !== undefined) {
      if (value !== undefined && value !== config[key])
        throw new TypeError(`Type "${typeName}" sets "${key}" in more than one definition.`);
      value = config[key];
    }
  }
  return value;
}

function concatAll<T>(configs: readonly any[], key: string, typeName: string): T[] {
  const output: T[] = [];
  for (const config of configs) {
    if (!hasOwn(config, key) || !config[key]) continue;
    const values = resolveThunk<T[]>(config[key]);
    if (!Array.isArray(values))
      throw new TypeError(`The "${key}" of "${typeName}" are undefined.${circularHint}`);
    output.push(...values);
  }
  return output;
}

function mergeExtensions(configs: readonly any[]): Extensions | undefined {
  let output: Extensions | undefined;
  for (const config of configs)
    if (config.extensions) output = Object.assign(output || {}, config.extensions);
  return output;
}

/** @internal */
export function buildSchema(config: BuildConfig, fieldBuilder: unknown): GraphQLSchema {
  const definitions = new Map<string, Ref[]>();
  const register = (definition: Ref | undefined, source: string) => {
    if (!definition)
      throw new TypeError(`schema({ ${source} }) received an undefined type.${circularHint}`);
    if (!definition['~config']) return;
    const name = definition.name!;
    if (builtinScalars.has(name))
      throw new TypeError(`Type "${name}" is a built-in scalar and may not be redefined.`);
    let group = definitions.get(name);
    if (!group) definitions.set(name, (group = []));
    if (group.indexOf(definition) > -1) return;
    if (group.length && group[0].kind !== definition.kind)
      throw new TypeError(
        `Type "${name}" is defined as both ${group[0].kind} and ${definition.kind}.`
      );
    group.push(definition);
  };

  register(config.query, 'query');
  if (config.mutation) register(config.mutation, 'mutation');
  if (config.subscription) register(config.subscription, 'subscription');
  (config.types || []).forEach((definition, index) => register(definition, `types[${index}]`));

  const rootNames = [config.query, config.mutation, config.subscription]
    .filter(Boolean)
    .map((root) => root!.name);
  rootNames.forEach((name, index) => {
    if (rootNames.indexOf(name) !== index)
      throw new TypeError(
        `Type "${name}" is used for more than one root operation type, which must all be different.`
      );
  });

  const subscriptionName = config.subscription && config.subscription.name;

  const directiveDefinitions = new Map<string, Ref>();
  (config.directives || []).forEach((directive, index) => {
    if (!directive)
      throw new TypeError(
        `schema({ directives }) received an undefined directive at index ${index}.${circularHint}`
      );
    const existing = directiveDefinitions.get(directive.name!);
    if (existing && existing !== directive)
      throw new TypeError(`Directive "@${directive.name}" is defined more than once.`);
    directiveDefinitions.set(directive.name!, directive);
  });

  const applyDirectives = (
    location: string,
    coordinate: string,
    applied: readonly Applied[],
    extensions: Extensions | undefined
  ): Extensions | undefined => {
    if (!applied.length) return extensions;
    if (extensions && hasOwn(extensions, 'directives'))
      throw new TypeError(
        `"${coordinate}" sets both "directives" and "extensions.directives", which may not be combined.`
      );
    const directives: AppliedDirectives = [];
    for (const entry of applied) {
      if (!entry || !entry.directive)
        throw new TypeError(`A directive applied to "${coordinate}" is undefined.${circularHint}`);
      const { directive, args } = entry;
      const name = directive.name;
      if (directiveDefinitions.get(name) !== directive)
        throw new TypeError(
          `Directive "@${name}" is applied to "${coordinate}" but is missing from schema({ directives }).`
        );
      const directiveConfig = directive['~config'];
      if (directiveConfig.locations.indexOf(location) === -1)
        throw new TypeError(
          `Directive "@${name}" may not be used on ${location} ("${coordinate}").`
        );
      if (!directiveConfig.isRepeatable && directives.some((other) => other.name === name))
        throw new TypeError(
          `Directive "@${name}" is not repeatable but is applied to "${coordinate}" more than once.`
        );
      const argDefinitions = directiveConfig.args || {};
      for (const argName of Object.keys(args))
        if (!hasOwn(argDefinitions, argName))
          throw new TypeError(
            `Directive "@${name}" has no argument "${argName}" ("${coordinate}").`
          );
      const values: { [name: string]: unknown } = {};
      for (const argName of Object.keys(argDefinitions)) {
        const arg = argDefinitions[argName];
        const argConfig = isInputValueConfig(arg) ? arg : { type: arg };
        if (!argConfig.type)
          throw new TypeError(`The type of "@${name}(${argName}:)" is undefined.${circularHint}`);
        let value = hasOwn(args, argName) ? args[argName] : undefined;
        if (value === undefined) value = argConfig.defaultValue;
        if (value == null && argConfig.type.kind === 'NON_NULL')
          throw new TypeError(
            `Directive "@${name}" requires argument "${argName}" ("${coordinate}").`
          );
        if (value !== undefined) values[argName] = value;
      }
      directives.push({ name, args: values });
    }
    return { ...extensions, directives };
  };

  const built = new Map<string, GraphQLNamedType>();

  const getNamedType = (ref: Ref | undefined, coordinate: string): GraphQLNamedType => {
    if (!ref || !ref.name)
      throw new TypeError(`The type of "${coordinate}" is undefined.${circularHint}`);
    const name = ref.name;
    const builtin = builtinScalars.get(name);
    if (builtin) {
      if (ref.kind !== 'SCALAR')
        throw new TypeError(`Type "${name}" is referenced as ${ref.kind} but is a SCALAR.`);
      return builtin;
    }
    const group = definitions.get(name);
    if (!group)
      throw new TypeError(
        `Type "${name}" is referenced but no definition was passed to schema({ types }).`
      );
    if (group[0].kind !== ref.kind)
      throw new TypeError(`Type "${name}" is referenced as ${ref.kind} but is a ${group[0].kind}.`);
    if (ref['~config'] && group.indexOf(ref) === -1)
      throw new TypeError(
        `Type "${name}" is referenced by a definition that wasn't passed to schema({ types }).`
      );
    let type = built.get(name);
    if (!type) {
      type = createNamedType(
        name,
        group[0].kind,
        group.map((definition) => definition['~config'])
      );
      built.set(name, type);
    }
    return type;
  };

  const getType = (ref: Ref | undefined, coordinate: string): GraphQLType => {
    if (!ref) {
      throw new TypeError(`The type of "${coordinate}" is undefined.${circularHint}`);
    } else if (ref.kind === 'NON_NULL') {
      return new GraphQLNonNull(getType(ref.ofType, coordinate) as any);
    } else if (ref.kind === 'LIST') {
      return new GraphQLList(getType(ref.ofType, coordinate));
    } else {
      return getNamedType(ref, coordinate);
    }
  };

  const createInputValues = (
    values: { [name: string]: any } | undefined,
    location: string,
    coordinate: (name: string) => string
  ): any => {
    const output: GraphQLFieldConfigArgumentMap & GraphQLInputFieldConfigMap = {};
    for (const name of Object.keys(values || {})) {
      const input = values![name];
      const value = isInputValueConfig(input) ? input : { type: input };
      output[name] = {
        type: getType(value.type, coordinate(name)) as any,
        defaultValue: value.defaultValue,
        description: value.description,
        deprecationReason: value.deprecationReason,
        extensions: applyDirectives(
          location,
          coordinate(name),
          value.directives || [],
          value.extensions
        ),
      };
    }
    return output;
  };

  const createFields = (typeName: string, configs: readonly any[]) => () => {
    const output: GraphQLFieldConfigMap<unknown, unknown> = {};
    for (const config of configs) {
      if (!config.fields) continue;
      const fields = config.fields(fieldBuilder);
      for (const fieldName of Object.keys(fields)) {
        const coordinate = `${typeName}.${fieldName}`;
        if (hasOwn(output, fieldName))
          throw new TypeError(`Field "${coordinate}" is defined more than once.`);
        const field = fields[fieldName];
        if (!field) throw new TypeError(`Field "${coordinate}" is undefined.${circularHint}`);
        if (field.subscribe && typeName !== subscriptionName)
          throw new TypeError(
            `Field "${coordinate}" sets "subscribe", which is only allowed on the subscription root type.`
          );
        output[fieldName] = {
          type: getType(field.type, coordinate) as any,
          args: createInputValues(
            field.args,
            'ARGUMENT_DEFINITION',
            (argName) => `${coordinate}(${argName}:)`
          ),
          description: field.description,
          deprecationReason: field.deprecationReason,
          resolve: field.resolve,
          subscribe: field.subscribe,
          extensions: applyDirectives(
            'FIELD_DEFINITION',
            coordinate,
            field.directives || [],
            field.extensions
          ),
        };
      }
    }
    return output;
  };

  const uniqueTypes =
    (typeName: string, configs: readonly any[], key: string, describe: string) => (): any[] => {
      const output: GraphQLNamedType[] = [];
      for (const ref of concatAll<Ref>(configs, key, typeName)) {
        const type = getNamedType(ref, `${typeName} ${key}`);
        if (output.indexOf(type) > -1)
          throw new TypeError(`Type "${typeName}" ${describe} "${type.name}" more than once.`);
        output.push(type);
      }
      return output;
    };

  const createNamedType = (name: string, kind: string, configs: readonly any[]) => {
    const description = pickOne(configs, 'description', name);
    const extensions = applyDirectives(
      kind,
      name,
      concatAll<Applied>(configs, 'directives', name),
      mergeExtensions(configs)
    );
    switch (kind) {
      case 'OBJECT':
        return new GraphQLObjectType({
          name,
          description,
          extensions,
          isTypeOf: pickOne(configs, 'isTypeOf', name),
          interfaces: uniqueTypes(name, configs, 'interfaces', 'implements'),
          fields: createFields(name, configs),
        });
      case 'INTERFACE':
        return new GraphQLInterfaceType({
          name,
          description,
          extensions,
          resolveType: pickOne(configs, 'resolveType', name),
          interfaces: uniqueTypes(name, configs, 'interfaces', 'implements'),
          fields: createFields(name, configs),
        });
      case 'UNION':
        return new GraphQLUnionType({
          name,
          description,
          extensions,
          resolveType: pickOne(configs, 'resolveType', name),
          types: uniqueTypes(name, configs, 'types', 'includes'),
        });
      case 'ENUM': {
        const values: GraphQLEnumValueConfigMap = {};
        for (const config of configs) {
          const input = config.values || [];
          const entries: [string, any][] = Array.isArray(input)
            ? input.map((valueName: string) => [valueName, {}])
            : Object.keys(input).map((valueName) => [valueName, input[valueName] || {}]);
          for (const [valueName, value] of entries) {
            if (hasOwn(values, valueName))
              throw new TypeError(`Enum value "${name}.${valueName}" is defined more than once.`);
            values[valueName] = {
              value: hasOwn(value, 'value') ? value.value : valueName,
              description: value.description,
              deprecationReason: value.deprecationReason,
              extensions: applyDirectives(
                'ENUM_VALUE',
                `${name}.${valueName}`,
                value.directives || [],
                value.extensions
              ),
            };
          }
        }
        return new GraphQLEnumType({ name, description, extensions, values });
      }
      case 'SCALAR':
        return new GraphQLScalarType({
          name,
          description,
          extensions,
          specifiedByURL: pickOne(configs, 'specifiedByURL', name),
          serialize: pickOne(configs, 'serialize', name),
          parseValue: pickOne(configs, 'parseValue', name),
          parseLiteral: pickOne(configs, 'parseLiteral', name),
        });
      case 'INPUT_OBJECT': {
        let isOneOf = false;
        for (const config of configs) if (config.isOneOf) isOneOf = true;
        const type = new GraphQLInputObjectType({
          name,
          description,
          extensions,
          isOneOf,
          fields: () => {
            const output: GraphQLInputFieldConfigMap = {};
            for (const config of configs) {
              const input = createInputValues(
                resolveThunk(config.fields || {}),
                'INPUT_FIELD_DEFINITION',
                (fieldName) => `${name}.${fieldName}`
              );
              for (const fieldName of Object.keys(input)) {
                if (hasOwn(output, fieldName))
                  throw new TypeError(
                    `Input field "${name}.${fieldName}" is defined more than once.`
                  );
                output[fieldName] = input[fieldName];
              }
            }
            return output;
          },
        });
        if (isOneOf && (type as { isOneOf?: boolean }).isOneOf !== true)
          throw new TypeError(
            `Input object "${name}" is a OneOf Input Object, which requires graphql@^16.9.0.`
          );
        return type;
      }
      default:
        throw new TypeError(`Type "${name}" has an unknown kind "${kind}".`);
    }
  };

  const directives: GraphQLDirective[] = [];
  for (const [name, directive] of directiveDefinitions) {
    if (specifiedDirectives.some((specified) => specified.name === name))
      throw new TypeError(`Directive "@${name}" is a built-in directive and may not be redefined.`);
    const directiveConfig = directive['~config'];
    const locations: readonly string[] = directiveConfig.locations || [];
    if (!locations.length)
      throw new TypeError(`Directive "@${name}" must have at least one location.`);
    for (const location of locations)
      if (directiveLocations.indexOf(location) === -1)
        throw new TypeError(`Directive "@${name}" has an unknown location "${location}".`);
    directives.push(
      new GraphQLDirective({
        name,
        description: directiveConfig.description,
        locations: locations as DirectiveLocation[],
        isRepeatable: !!directiveConfig.isRepeatable,
        extensions: directiveConfig.extensions,
        args: createInputValues(
          directiveConfig.args,
          'ARGUMENT_DEFINITION',
          (argName) => `@${name}(${argName}:)`
        ),
      })
    );
  }

  const schema = new GraphQLSchema({
    description: config.description,
    query: getNamedType(config.query, 'schema query') as GraphQLObjectType,
    mutation:
      config.mutation && (getNamedType(config.mutation, 'schema mutation') as GraphQLObjectType),
    subscription:
      config.subscription &&
      (getNamedType(config.subscription, 'schema subscription') as GraphQLObjectType),
    types: [...definitions.keys()].map((name) => getNamedType(definitions.get(name)![0], name)),
    directives: [...specifiedDirectives, ...directives],
    assumeValid: config.assumeValid,
    extensions: applyDirectives(
      'SCHEMA',
      'schema',
      config.schemaDirectives || [],
      config.extensions
    ),
  });

  assertNoSelfReferences(directives);
  if (!config.assumeValid) assertValidSchema(schema);
  return schema;
}

const appliedNames = (extensions: { readonly directives?: unknown } | null | undefined) =>
  extensions && Array.isArray(extensions.directives)
    ? (extensions.directives as AppliedDirectives).map((applied) => applied.name)
    : [];

/** Directives must not reference themselves, directly or via the types or directives they reference (Spec: 3.13)
 * @remarks
 * Directives and the input types reachable from their arguments form a graph, in which a directive
 * references itself if it's part of a cycle. These are found in a single pass with Tarjan's algorithm.
 */
function assertNoSelfReferences(directives: readonly GraphQLDirective[]) {
  const directivesByName = new Map(
    directives.map((directive) => [`@${directive.name}`, directive])
  );
  const edges = new Map<unknown, unknown[]>();
  const edgesOf = (node: GraphQLDirective | GraphQLNamedType): unknown[] => {
    let output = edges.get(node);
    if (output) return output;
    edges.set(node, (output = []));
    const addApplied = (extensions: { readonly directives?: unknown } | null | undefined) => {
      for (const name of appliedNames(extensions)) {
        const directive = directivesByName.get(`@${name}`);
        if (directive) output!.push(directive);
      }
    };
    if (node instanceof GraphQLDirective) {
      for (const arg of node.args) {
        addApplied(arg.extensions);
        output.push(unwrapNamedType(arg.type));
      }
    } else {
      addApplied(node.extensions);
      if (isInputObjectType(node)) {
        for (const field of Object.values(node.getFields())) {
          addApplied(field.extensions);
          output.push(unwrapNamedType(field.type));
        }
      } else if (isEnumType(node)) {
        for (const value of node.getValues()) addApplied(value.extensions);
      }
    }
    return output;
  };

  let index = 0;
  const indices = new Map<unknown, number>();
  const lowlinks = new Map<unknown, number>();
  const stack: unknown[] = [];
  const onStack = new Set<unknown>();
  const visit = (node: any) => {
    indices.set(node, index);
    lowlinks.set(node, index++);
    stack.push(node);
    onStack.add(node);
    for (const next of edgesOf(node)) {
      if (!indices.has(next)) {
        visit(next);
        lowlinks.set(node, Math.min(lowlinks.get(node)!, lowlinks.get(next)!));
      } else if (onStack.has(next)) {
        lowlinks.set(node, Math.min(lowlinks.get(node)!, indices.get(next)!));
      }
    }
    if (lowlinks.get(node) === indices.get(node)) {
      const component: unknown[] = [];
      let member: unknown;
      do {
        onStack.delete((member = stack.pop()));
        component.push(member);
      } while (member !== node);
      const cyclic = component.length > 1 || edgesOf(node).indexOf(node) > -1;
      const directive = directives.find((directive) => component.indexOf(directive) > -1);
      if (cyclic && directive)
        throw new TypeError(`Directive "@${directive.name}" must not reference itself.`);
    }
  };
  for (const directive of directives) if (!indices.has(directive)) visit(directive);
}
