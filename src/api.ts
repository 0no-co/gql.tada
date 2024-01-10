import { parse as _parse } from '@0no-co/graphql.web';
import type { stringLiteral } from './utils';
import type { parseDocument } from './parser';

function parse<const In extends stringLiteral<In>>(input: In): parseDocument<In> {
  return _parse(input) as any;
}

export { parse };
