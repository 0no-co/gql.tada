import type { PrivateMode } from './csi';
import { cmd, Mode } from './csi';
import { isTTY, output } from './tty';

const mode = (...modes: readonly (Mode | PrivateMode)[]): void => {
  if (isTTY) {
    const normalModes: Mode[] = [];
    const privateModes: PrivateMode[] = [];
    for (const mode of modes) {
      if (mode === Mode.Insert || mode === Mode.AutomaticNewline) {
        normalModes.push(mode);
      } else {
        privateModes.push(mode);
      }
    }
    if (normalModes.length) output.write(cmd(cmd.SetMode, normalModes));
    if (privateModes.length) output.write(cmd(cmd.SetPrivateMode, privateModes));
  }
};

const modeOff = (...modes: readonly (Mode | PrivateMode)[]): void => {
  if (isTTY) {
    const normalModes: Mode[] = [];
    const privateModes: PrivateMode[] = [];
    for (const mode of modes) {
      if (mode === Mode.Insert || mode === Mode.AutomaticNewline) {
        normalModes.push(mode);
      } else {
        privateModes.push(mode);
      }
    }
    if (normalModes.length) output.write(cmd(cmd.UnsetMode, normalModes));
    if (privateModes.length) output.write(cmd(cmd.UnsetPrivateMode, privateModes));
  }
};

export { mode, modeOff };
