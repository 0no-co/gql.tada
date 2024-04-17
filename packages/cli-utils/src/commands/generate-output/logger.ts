import * as t from '../../term';

import { hint, code } from '../shared/logger';
export * from '../shared/logger';

export function summary(showHint?: boolean) {
  let out = t.text([
    t.cmd(t.CSI.Style, t.Style.BrightGreen),
    `${t.Icons.Tick} Introspection output was generated successfully\n`,
  ]);
  if (showHint) {
    out += hint(
      `The pipe output was generated in the ${code('.d.ts')} format.\n` +
        `For the ${code('.ts')} format, pass the ${code('--force-ts-format')} argument.\n`
    );
  }
  return out;
}
