import * as t from 'typanion';
import { Command, Option } from 'clipanion';

const isHeaderEntries = t.isArray(t.cascade(t.isString(), t.matchesRegExp(/^[\w-]+[ ]*:[ ]*.+/i)));

export class GenerateSchema extends Command {
  static paths = [['generate-schema'], ['generate', 'schema']];

  input = Option.String({
    name: 'schema',
    required: true,
  });

  output = Option.String('--output,-o', {
    description:
      "Specifies where to output the file to.\tDefault: The `schema` configuration option, if it's a file path",
  });

  headers = Option.Array('--header', {
    description: 'Headers to be used when introspection a schema from a remote URL',
    validator: isHeaderEntries,
  });

  async execute() {
    return 0;
  }
}
