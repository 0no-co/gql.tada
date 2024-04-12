let hasColor = false;

export function _setColor(color: boolean) {
  hasColor = color;
}

// See: http://xtermjs.org/docs/api/vtfeatures/#csi
const enum CSI {
  InsertChars = '@',
  ScrollLeft = 'SP@',
  Up = 'A',
  ScrollRight = 'SPA',
  Down = 'B',
  Forward = 'C',
  Backward = 'D',
  NextLine = 'E',
  PrevLine = 'F',
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

const enum TabClear {
  Current = 0,
  All = 3,
}

const enum Erase {
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

const enum Protect {
  Insert = 4,
  AutomaticNewline = 20,
}

const enum Mode {
  Insert = 4,
  AutomaticNewline = 20,
}

const enum PrivateMode {
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

const enum Cursor {
  Empty = 0,
  Block = 1,
  BlinkBlock = 2,
  Underline = 3,
  BlinkUnderline = 4,
  Bar = 5,
  BlinkBar = 6,
}

const enum Style {
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

type escapeCSI = '\x1B[';
const escapeCSI = '\x1B[';

type CommandNoParam = CSI.Reset | CSI.SaveCursor | CSI.RestoreCursor | CSI.ResetPrivateMode;

type CommandSingleParam =
  | CSI.ScrollLeft
  | CSI.ScrollRight
  | CSI.ScrollUp
  | CSI.ScrollDown
  | CSI.Up
  | CSI.Down
  | CSI.Backward
  | CSI.Forward
  | CSI.PrevLine
  | CSI.NextLine
  | CSI.DownLine
  | CSI.ToColumn
  | CSI.ToRow
  | CSI.Tab
  | CSI.TabBackwards
  | CSI.InsertChars
  | CSI.InsertLines
  | CSI.InsertColumns
  | CSI.DeleteChars
  | CSI.DeleteLines
  | CSI.DeleteColumns
  | CSI.RepeatChar;

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

function cmd(code: CommandNoParam): `${escapeCSI}${CommandNoParam}`;
function cmd(
  code: CommandSingleParam,
  count?: number
): `${escapeCSI}${number}${CommandSingleParam}`;
function cmd(code: CSI.TabClear, mode?: TabClear): `${escapeCSI}${TabClear}${CSI.TabClear}`;
function cmd(code: CSI.Erase, mode?: Erase): `${escapeCSI}${Erase}${CSI.Erase}`;
function cmd(code: CSI.EraseLine, mode?: EraseLine): `${escapeCSI}${EraseLine}${CSI.EraseLine}`;
function cmd(code: CSI.Protect, mode?: Protect): `${escapeCSI}${Protect}${CSI.Protect}`;
function cmd(code: CSI.Cursor, style: Cursor): `${escapeCSI}${Cursor}${CSI.Cursor}`;

function cmd(
  code: CSI.ToPosition,
  row: number,
  column: number
): `${escapeCSI}${number};${number}${CSI.ToPosition}`;

function cmd(
  code: CSI.SetMargin,
  top: number,
  bottom: number
): `${escapeCSI}${number};${number}${CSI.SetMargin}`;

function cmd(code: CSI.SetMode, modes: Mode | readonly Mode[]): `${escapeCSI}${Mode}${CSI.SetMode}`;

function cmd(
  code: CSI.SetPrivateMode,
  modes: PrivateMode | readonly PrivateMode[]
): `${escapeCSI}?${PrivateMode}${CSI.SetMode}`;

function cmd(
  code: CSI.UnsetMode,
  modes: Mode | readonly Mode[]
): `${escapeCSI}${Mode}${CSI.UnsetMode}`;

function cmd(
  code: CSI.UnsetPrivateMode,
  modes: PrivateMode | readonly PrivateMode[]
): `${escapeCSI}?${PrivateMode}${CSI.UnsetMode}`;

function cmd(code: CSI.Style, styles: Style | readonly Style[]): `${escapeCSI}${Style}${CSI.Style}`;

function cmd(code: CSI, a?: CommandParam, b?: number): cmdCode {
  if (!hasColor && code === CSI.Style) return '';
  let out = escapeCSI;
  if (code === CSI.SetPrivateMode) {
    out += '?';
    code = CSI.SetMode;
  } else if (code === CSI.UnsetPrivateMode) {
    out += '?';
    code = CSI.UnsetMode;
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

export type cmdCode = `${escapeCSI}${string}${CSI}` | '';

export { cmd, CSI, TabClear, Erase, EraseLine, Protect, Mode, PrivateMode, Cursor, Style };
