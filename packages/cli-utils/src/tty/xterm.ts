import { stripAnsi } from './string';

export const isTTY = !!process.stdout.isTTY && process.env.TERM !== 'dumb' && !process.env.CI;

const hasColorArg = process.argv.includes('--color');
const hasColorEnv = process.env.FORCE_COLOR || (!process.env.NO_COLOR && !process.env.CI);
export const hasColor = (isTTY && hasColorEnv) || hasColorArg;

// See: http://xtermjs.org/docs/api/vtfeatures/#csi
const enum FnCSI {
  InsertChars = '@',
  ScrollLeft = 'SP@',
  Up = 'A',
  ScrollRight = 'SPA',
  Down = 'B',
  Forward = 'C',
  Backward = 'D',
  PrevLine = 'E',
  NextLine = 'F',
  Column = 'G',
  Position = 'H',
  Tab = 'I',
  EraseDisplay = 'J',
  EraseLine = 'K',
  InsertLine = 'L',
  DeleteLine = 'M',
  DeleteChars = 'P',
  ScrollUp = 'S',
  ScrollDown = 'T',
  EraseChars = 'X',
  TabBackwards = 'Z',
  RepeatChar = 'b',
  Row = 'd',
  DownLine = 'e',
  TabClear = 'g',
  SetMode = 'h',
  UnsetMode = 'l',
  Style = 'm',
  Reset = '!p',
  Protect = '"q',
  CursorStyle = 'SPq',
  SetMargin = 'r',
  SaveCursor = 's',
  RestoreCursor = 'u',
  InsertColumns = "'}",
  DeleteColumns = "'~",
}

const enum EraseDisplay {
  Forward = 0,
  Backward = 1,
  All = 2,
  Scrollback = 3,
}

const enum EraseLine {
  Forward = 0,
  Backward = 1,
  All = 2,
}

export const enum Mode {
  Insert = 4,
  AutomaticNewline = 20,
}

export const enum PrivateMode {
  AppCursorKeys = 1,
  USASCII = 2,
  Column132 = 3,
  OriginMode = 6,
  AutoWrap = 7,
  AutoRepeat = 8,
  X10Mouse = 9,
  BlinkCursor = 12,
  ShowCursor = 25,
  ReverseWrapAround = 45,
  AlternativeScreenBuffer = 47,
  AppKeypad = 66,
  X11Mouse = 1000,
  CellMotionMouseTracking = 1002,
  AllMotionMouseTracking = 1003,
  FocusEvents = 1004,
  Utf8Mouse = 1005,
  SGRMouse = 1006,
  UrxvtMouse = 1015,
  SGRPixelsMouse = 1016,
  SaveCursor = 1048,
  BracketedPaste = 2004,
}

export const enum CursorStyle {
  Empty = 0,
  Block = 1,
  BlinkBlock = 2,
  Underline = 3,
  BlinkUnderline = 4,
  Bar = 5,
  BlinkBar = 6,
}

export const enum Style {
  Reset = 0,
  Bold = 1,
  Faint = 2,
  Italic = 3,
  Underline = 4,
  Blink = 5,
  RapidBlink = 6,
  Invert = 7,
  Invisible = 8,
  Strikethrough = 9,
  DoubleUnderlined = 21,
  Normal = 22, // No Bold, No Faint
  NoItalic = 23,
  NoUnderline = 24,
  NoBlink = 25,
  NoInvert = 27,
  Visible = 28,
  NoStrikethrough = 29,

  Black = 30,
  Red = 31,
  Green = 32,
  Yellow = 33,
  Blue = 34,
  Magenta = 35,
  Cyan = 36,
  White = 37,
  Foreground = 39,

  OnBlack = 40,
  OnRed = 41,
  OnGreen = 42,
  OnYellow = 43,
  OnBlue = 44,
  OnMagenta = 45,
  OnCyan = 46,
  OnWhite = 47,
  OnBackground = 49,

  BrightBlack = 90,
  BrightRed = 91,
  BrightGreen = 92,
  BrightYellow = 93,
  BrightBlue = 94,
  BrightMagenta = 95,
  BrightCyan = 96,
  BrightWhite = 97,

  OnBrightBlack = 100,
  OnBrightRed = 101,
  OnBrightGreen = 102,
  OnBrightYellow = 103,
  OnBrightBlue = 104,
  OnBrightMagenta = 105,
  OnBrightCyan = 106,
  OnBrightWhite = 107,

  DoubleUnderline = '4:2',
  CurlyUnderline = '4:3',
  DottedUnderline = '4:4',
  DashedUnderline = '4:5',
}

const CSI = '\x1B[';
const NONE = '';

export const scrollLeft = (cols = 1) => `${CSI}${cols}${FnCSI.ScrollLeft}`;
export const scrollRight = (cols = 1) => `${CSI}${cols}${FnCSI.ScrollRight}`;
export const scrollUp = (rows = 1) => `${CSI}${rows}${FnCSI.ScrollUp}`;
export const scrollDown = (rows = 1) => `${CSI}${rows}${FnCSI.ScrollDown}`;

export const up = (num = 1) => `${CSI}${num}${FnCSI.Up}`;
export const down = (num = 1) => `${CSI}${num}${FnCSI.Down}`;
export const forward = (num = 1) => `${CSI}${num}${FnCSI.Forward}`;
export const backward = (num = 1) => `${CSI}${num}${FnCSI.Backward}`;

export const prevLine = (lines = 1) => `${CSI}${lines}${FnCSI.PrevLine}`;
export const nextLine = (lines = 1) => `${CSI}${lines}${FnCSI.NextLine}`;
export const downLine = (lines = 1) => `${CSI}${lines}${FnCSI.DownLine}`;

export const setColumn = (col = 1) => `${CSI}${col}${FnCSI.Column}`;
export const setPosition = (row = 1, col = 1) => `${CSI}${row};${col}${FnCSI.Position}`;
export const setRow = (row = 1) => `${CSI}${row}${FnCSI.Row}`;

export const tab = (num = 1) => `${CSI}${num}${FnCSI.Tab}`;
export const tabBackwards = (num = 1) => `${CSI}${num}${FnCSI.TabBackwards}`;
export const tabClearCurrent = `${CSI}${0}${FnCSI.TabClear}`;
export const tabClearAll = `${CSI}${3}${FnCSI.TabClear}`;

export const eraseForward = `${CSI}${EraseDisplay.Forward}${FnCSI.EraseDisplay}`;
export const eraseBackward = `${CSI}${EraseDisplay.Backward}${FnCSI.EraseDisplay}`;
export const eraseAll = `${CSI}${EraseDisplay.All}${FnCSI.EraseDisplay}`;
export const eraseScrollback = `${CSI}${EraseDisplay.Scrollback}${FnCSI.EraseDisplay}`;

export const eraseLineForward = `${CSI}${EraseDisplay.Forward}${FnCSI.EraseLine}`;
export const eraseLineBackward = `${CSI}${EraseDisplay.Backward}${FnCSI.EraseLine}`;
export const eraseLine = `${CSI}${EraseLine.All}${FnCSI.EraseLine}`;

export const eraseChars = (num = 1) => `${CSI}${num}${FnCSI.EraseChars}`;

export const insertChars = (chars = 1) => `${CSI}${chars}${FnCSI.InsertChars}`;
export const insertLine = (num = 1) => `${CSI}${num}${FnCSI.InsertLine}`;
export const deleteLine = (num = 1) => `${CSI}${num}${FnCSI.DeleteLine}`;
export const deleteChars = (num = 1) => `${CSI}${num}${FnCSI.DeleteChars}`;
export const repeatChar = (num = 1) => `${CSI}${num}${FnCSI.RepeatChar}`;
export const insertColumns = (num = 1) => `${CSI}${num}${FnCSI.InsertColumns}`;
export const deleteColumns = (num = 1) => `${CSI}${num}${FnCSI.DeleteColumns}`;

const activeModes: (Mode | PrivateMode)[] = [];

export const setMode = (...setModes: (Mode | PrivateMode)[]): void => {
  if (isTTY) {
    let normalModes = '';
    let privateModes = '';
    for (const mode of setModes) {
      if (activeModes.includes(mode)) continue;
      activeModes.push(mode);
      switch (mode) {
        case Mode.Insert:
        case Mode.AutomaticNewline:
          normalModes = normalModes ? `${normalModes}:${mode}` : `${mode}`;
          break;
        default:
          privateModes = privateModes ? `${privateModes}:${mode}` : `${mode}`;
      }
    }
    if (normalModes) writeRaw(`${CSI}${normalModes}${FnCSI.SetMode}`);
    if (privateModes) writeRaw(`${CSI}?${privateModes}${FnCSI.SetMode}`);
  }
};

export const unsetMode = (...unsetModes: (Mode | PrivateMode)[]) => {
  if (isTTY) {
    let normalModes = '';
    let privateModes = '';
    for (const mode of unsetModes.length ? unsetModes : [...activeModes]) {
      const index = activeModes.indexOf(mode);
      if (index === -1) continue;
      activeModes.splice(index, 1);
      switch (mode) {
        case Mode.Insert:
        case Mode.AutomaticNewline:
          normalModes = normalModes ? `${normalModes}:${mode}` : `${mode}`;
          break;
        default:
          privateModes = privateModes ? `${privateModes}:${mode}` : `${mode}`;
      }
    }
    if (normalModes) writeRaw(`${CSI}${normalModes}${FnCSI.UnsetMode}`);
    if (privateModes) writeRaw(`${CSI}?${privateModes}${FnCSI.UnsetMode}`);
  }
};

export function showCursor(show = true) {
  (show ? setMode : unsetMode)(PrivateMode.ShowCursor);
}

export const reset = `${CSI}${FnCSI.Reset}`;

export const setProtect = `${CSI}${0}${FnCSI.Protect}`;
export const unsetProtect = `${CSI}${1}${FnCSI.Protect}`;

export const setCursorStyle = (style: CursorStyle) => `${CSI}${style}${FnCSI.CursorStyle}`;

export const setMargin = (top = 0, bottom = 0) => `${CSI}${top};${bottom}${FnCSI.SetMargin}`;

export const saveCursor = `${CSI}${FnCSI.SaveCursor}`;
export const restoreCursor = `${CSI}${FnCSI.RestoreCursor}`;

export const style = (...styles: Style[]) =>
  hasColor ? `${CSI}${styles.join(';')}${FnCSI.Style}` : NONE;

export const resetStyle = hasColor ? `${CSI}${Style.Reset}${FnCSI.Style}` : NONE;

export const rgbStyle = (r: number, g: number, b: number): Style => `38:2:${r}:${g}:${b}` as Style;
export const onRgbStyle = (r: number, g: number, b: number): Style =>
  `48:2:${r}:${g}:${b}` as Style;
export const rgb = (r: number, g: number, b: number) =>
  hasColor ? `${CSI}${rgbStyle(r, g, b)}${FnCSI.Style}` : NONE;
export const onRgb = (r: number, g: number, b: number) =>
  hasColor ? `${CSI}${onRgbStyle(r, g, b)}${FnCSI.Style}` : NONE;

let buffer = '';
let frame: any;

function flush() {
  if (frame != null) clearImmediate(frame);
  frame = null;
  process.stdout.write(buffer);
  buffer = '';
}

function writeRaw(input: string) {
  buffer += isTTY ? input : stripAnsi(input);
  if (frame == null) frame = setImmediate(flush);
}

function write(input: readonly string[], ...args: readonly string[]): void;
function write(input: string, ...args: readonly string[]): void;

function write(input: string | readonly string[], ...args: readonly string[]): void {
  if (Array.isArray(input)) {
    let argIndex = 0;
    for (let index = 0; index < input.length; index++) {
      writeRaw(input[index]);
      if (argIndex < args.length) writeRaw(args[argIndex++]);
    }
  } else {
    writeRaw(input as string);
    for (const arg of args) writeRaw(arg);
  }
}

export let columns = 0;
export let rows = 0;

if (isTTY) {
  writeRaw(`${CSI}?${PrivateMode.ShowCursor}${FnCSI.UnsetMode}`);
  writeRaw(reset);
  flush();

  columns = process.stdout.columns;
  rows = process.stdout.rows;
  process.stdout.on('resize', () => {
    columns = process.stdout.columns;
    rows = process.stdout.rows;
  });

  process.on('exit', () => {
    unsetMode();
    setMode(PrivateMode.ShowCursor);
    writeRaw(reset + '\n');
    flush();
  });

  process.stdout.write(reset);
}

export { write, writeRaw, flush };
