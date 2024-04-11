let hasColor = false;

export function _setColor(color: boolean) {
  hasColor = color;
}

// See: http://xtermjs.org/docs/api/vtfeatures/#csi
enum Command {
  InsertChars = '@',
  ScrollLeft = 'SP@',
  Up = 'A',
  ScrollRight = 'SPA',
  Down = 'B',
  Forward = 'C',
  Backward = 'D',
  PrevLine = 'E',
  NextLine = 'F',
  ToColumn = 'G',
  ToPosition = 'H',
  Tab = 'I',
  Erase = 'J',
  EraseLine = 'K',
  InsertLines = 'L',
  DeleteLines = 'M',
  DeleteChars = 'P',
  ScrollUp = 'S',
  ScrollDown = 'T',
  EraseChars = 'X',
  TabBackwards = 'Z',
  RepeatChar = 'b',
  ToRow = 'd',
  DownLine = 'e',
  TabClear = 'g',
  SetMode = 'h',
  UnsetMode = 'l',
  SetPrivateMode = '?h',
  UnsetPrivateMode = '?l',
  ResetPrivateMode = '?r',
  Style = 'm',
  Reset = '!p',
  Protect = '"q',
  Cursor = 'SPq',
  SetMargin = 'r',
  SaveCursor = 's',
  RestoreCursor = 'u',
  InsertColumns = "'}",
  DeleteColumns = "'~",
}

enum TabClear {
  Current = 0,
  All = 3,
}

enum Erase {
  Forward = 0,
  Backward = 1,
  All = 2,
  Scrollback = 3,
}

enum EraseLine {
  Forward = 0,
  Backward = 1,
  All = 2,
}

enum Protect {
  Insert = 4,
  AutomaticNewline = 20,
}

enum Mode {
  Insert = 4,
  AutomaticNewline = 20,
}

enum PrivateMode {
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

enum Cursor {
  Empty = 0,
  Block = 1,
  BlinkBlock = 2,
  Underline = 3,
  BlinkUnderline = 4,
  Bar = 5,
  BlinkBar = 6,
}

enum Style {
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

type CSI = '\x1B[';
const CSI = '\x1B[';

type CommandNoParam =
  | Command.Reset
  | Command.SaveCursor
  | Command.RestoreCursor
  | Command.ResetPrivateMode;

type CommandSingleParam =
  | Command.ScrollLeft
  | Command.ScrollRight
  | Command.ScrollUp
  | Command.ScrollDown
  | Command.Up
  | Command.Down
  | Command.Backward
  | Command.Forward
  | Command.PrevLine
  | Command.NextLine
  | Command.DownLine
  | Command.ToColumn
  | Command.ToRow
  | Command.Tab
  | Command.TabBackwards
  | Command.InsertChars
  | Command.InsertLines
  | Command.InsertColumns
  | Command.DeleteChars
  | Command.DeleteLines
  | Command.DeleteColumns
  | Command.RepeatChar;

type CommandParam =
  | number
  | TabClear
  | Erase
  | EraseLine
  | Protect
  | Cursor
  | Mode
  | PrivateMode
  | Style
  | readonly Mode[]
  | readonly PrivateMode[]
  | readonly Style[];

function _cmd(code: CommandNoParam): `${CSI}${CommandNoParam}`;
function _cmd(code: CommandSingleParam, count?: number): `${CSI}${number}${CommandSingleParam}`;
function _cmd(code: Command.TabClear, mode?: TabClear): `${CSI}${TabClear}${Command.TabClear}`;
function _cmd(code: Command.Erase, mode?: Erase): `${CSI}${Erase}${Command.Erase}`;
function _cmd(code: Command.EraseLine, mode?: EraseLine): `${CSI}${EraseLine}${Command.EraseLine}`;
function _cmd(code: Command.Protect, mode?: Protect): `${CSI}${Protect}${Command.Protect}`;
function _cmd(code: Command.Cursor, style: Cursor): `${CSI}${Cursor}${Command.Cursor}`;

function _cmd(
  code: Command.ToPosition,
  row: number,
  column: number
): `${CSI}${number};${number}${Command.ToPosition}`;

function _cmd(
  code: Command.SetMargin,
  top: number,
  bottom: number
): `${CSI}${number};${number}${Command.SetMargin}`;

function _cmd(
  code: Command.SetMode,
  modes: Mode | readonly Mode[]
): `${CSI}${Mode}${Command.SetMode}`;

function _cmd(
  code: Command.SetPrivateMode,
  modes: PrivateMode | readonly PrivateMode[]
): `${CSI}?${PrivateMode}${Command.SetMode}`;

function _cmd(
  code: Command.UnsetMode,
  modes: Mode | readonly Mode[]
): `${CSI}${Mode}${Command.UnsetMode}`;

function _cmd(
  code: Command.UnsetPrivateMode,
  modes: PrivateMode | readonly PrivateMode[]
): `${CSI}?${PrivateMode}${Command.UnsetMode}`;

function _cmd(
  code: Command.Style,
  styles: Style | readonly Style[]
): `${CSI}${Style}${Command.Style}`;

function _cmd(code: Command, a?: CommandParam, b?: number): cmdCode {
  if (!hasColor && code === Command.Style) return '';
  let out = CSI;
  if (code === Command.SetPrivateMode) {
    out += '?';
    code = Command.SetMode;
  } else if (code === Command.UnsetPrivateMode) {
    out += '?';
    code = Command.UnsetMode;
  }
  if (Array.isArray(a)) {
    out += a.join(';');
  } else if (a != null) {
    out += `${a}`;
    if (b != null) out += `;${b}`;
  }
  out += code;
  return out as cmdCode;
}

interface cmdCodes {
  tabClear: typeof TabClear;
  erase: typeof Erase;
  eraseLine: typeof EraseLine;
  protect: typeof Protect;
  cursor: typeof Cursor;
  mode: typeof Mode;
  privateMode: typeof PrivateMode;
  style: typeof Style;
}

type cmd = typeof _cmd & cmdCodes & typeof Command;

export const cmd: cmd = Object.assign(_cmd as cmd, Command, {
  tabClear: TabClear,
  erase: Erase,
  eraseLine: EraseLine,
  protect: Protect,
  cursor: Cursor,
  mode: Mode,
  privateMode: PrivateMode,
  style: Style,
});

export type cmdCode = `${CSI}${string}${Command}` | '';

export { Command, TabClear, Erase, EraseLine, Protect, Mode, PrivateMode, Cursor, Style };
