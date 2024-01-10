import { parse as _parse } from '@0no-co/graphql.web';
import type { stringLiteral } from './utils';
import type { parseDocument } from './parser';

function parse<const Input extends stringLiteral<Input>>(input: Input): parseDocument<Input> {
  return _parse(input) as any;
}

export { parse };
