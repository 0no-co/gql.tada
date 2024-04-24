import * as t from '../../term';

export * from '../shared/logger';

export function summary() {
  return t.text([
    t.cmd(t.CSI.Style, t.Style.BrightGreen),
    `${t.Icons.Tick} Schema was generated successfully\n`,
  ]);
}
