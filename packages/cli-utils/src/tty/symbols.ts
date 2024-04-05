export interface Box {
  TopLeft: string;
  TopRight: string;
  BottomLeft: string;
  BottomRight: string;
  Vertical: string;
  VerticalRight: string;
  VerticalLeft: string;
  Horizontal: string;
  HorizontalDown: string;
  HorizontalUp: string;
  Cross: string;
}

export enum DefaultBox {
  TopLeft = '┌',
  TopRight = '┐',
  BottomLeft = '└',
  BottomRight = '┘',
  Vertical = '│',
  VerticalRight = '├',
  VerticalLeft = '┤',
  Horizontal = '─',
  HorizontalDown = '┬',
  HorizontalUp = '┴',
  Cross = '┼',
}

export enum HeavyBox {
  TopLeft = '┏',
  TopRight = '┓',
  BottomLeft = '┗',
  BottomRight = '┛',
  Vertical = '┃',
  VerticalRight = '┣',
  VerticalLeft = '┫',
  Horizontal = '━',
  HorizontalDown = '┳',
  HorizontalUp = '┻',
  Cross = '╋',
}

export enum DoubleBox {
  TopLeft = '╔',
  TopRight = '╗',
  BottomLeft = '╚',
  BottomRight = '╝',
  Vertical = '║',
  VerticalRight = '╠',
  VerticalLeft = '╣',
  Horizontal = '═',
  HorizontalDown = '╦',
  HorizontalUp = '╩',
  Cross = '╬',
}

export enum RoundedBox {
  TopLeft = '╭',
  TopRight = '╮',
  BottomLeft = '╰',
  BottomRight = '╯',
  Vertical = '│',
  VerticalRight = '├',
  VerticalLeft = '┤',
  Horizontal = '─',
  HorizontalDown = '┬',
  HorizontalUp = '┴',
  Cross = '┼',
}

export enum Arrow {
  Right = '→',
  Left = '←',
  Up = '↑',
  Down = '↓',
  LeftRight = '↔',
  UpDown = '↕',
}

export enum Triangle {
  Right = '▶',
  Left = '◀',
  Up = '▲',
  Down = '▼',
}

export enum SmallTriangle {
  Right = '▸',
  Left = '◂',
  Up = '▴',
  Down = '▾',
}

export const enum Line {
  DiagonalCross = '╳',
  Diagonalbackwards = '╲',
  Diagonal = '╱',
  VerticalDashed = '┆',
  VerticalDashedHeavy = '┇',
  Vertical = '│',
  VerticalHeavy = '┃',
  HorizontalDashed = '┄',
  HorizontalDashedHeavy = '┅',
  Horizontal = '─',
  HorizontalHeavy = '━',
}

export const enum Circle {
  Filled = '●',
  Outline = '◯',
  OutlineFilled = '◉',
  Dotted = '◌',
  Doubled = '◎',
  Small = '•',
  HalfLeft = '◐',
  HalfTop = '◓',
  HalfRight = '◑',
  HalfBottom = '◒',
}

export const enum Chevron {
  Default = '',
  Small = '›',
  Heavy = '❯',
}

export const enum Diamond {
  Default = '◆',
  Outline = '◇',
}

export const enum Square {
  Default = '■',
  Outline = '☐',
  Crossed = '☒',
}

export const enum Heart {
  Default = '❤︎',
  Outline = '♥',
}

export const enum Icons {
  Tick = '✓',
  TickSwoosh = '✔',
  Cross = '×',
  CrossSwoosh = '✘',
  Home = '⌂',
  Note = '♪',
  Warning = '⚠',
  Info = 'ℹ',
  Star = '★',
}

export const enum Shade {
  Light = '░',
  Medium = '▒',
  Heavy = '▓',
}

export const dotSpinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
