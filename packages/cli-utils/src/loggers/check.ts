import { CLIError, Chars, Icons, HeavyBox, Style, circleSpinner, init, cmd, log } from '../term';
export { error } from '../term';

function delay(ms = 750) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function printTitle(title: string) {
  log([
    cmd(cmd.Style, Style.BrightBlack),
    HeavyBox.TopLeft,
    Chars.Space,
    cmd(cmd.Style, [Style.Magenta, Style.Invert]),
    Chars.Space,
    title.trim(),
    Chars.Space,
    cmd(cmd.Style, Style.Reset),
    Chars.Newline,
  ]);
}

function printLine(text?: string) {
  log([cmd(cmd.Style, Style.BrightBlack), HeavyBox.Vertical, Chars.Space]);
  if (text) log(text);
  log([cmd(cmd.Style, Style.Reset), Chars.Newline]);
}

function printCompletedTask(description: string, isLast = false) {
  log([
    cmd(cmd.Style, Style.BrightBlack),
    isLast ? HeavyBox.BottomLeft : HeavyBox.VerticalRight,
    Chars.Space,
    cmd(cmd.Style, Style.Green),
    Icons.TickSwoosh,
    Chars.Space,
    cmd(cmd.Style, Style.Foreground),
    description,
    cmd(cmd.Style, Style.Reset),
    Chars.Newline,
  ]);
}

function printFailedTask(description: string) {
  log([
    cmd(cmd.Style, Style.BrightBlack),
    HeavyBox.BottomLeft,
    Chars.Space,
    cmd(cmd.Style, Style.BrightRed),
    Icons.CrossSwoosh,
    Chars.Space,
    cmd(cmd.Style, Style.Foreground),
    description,
    cmd(cmd.Style, Style.Reset),
    Chars.Newline,
  ]);
}

function printRunningTask(description: string) {
  let state = 0;
  function print() {
    if (state) {
      log([cmd(cmd.DeleteLines, 1), cmd(cmd.ToColumn, 1)]);
    }
    log([
      cmd(cmd.Style, Style.Magenta),
      circleSpinner[state++ % circleSpinner.length],
      Chars.Space,
      cmd(cmd.Style, Style.Foreground),
      description,
      cmd(cmd.Style, Style.Reset),
    ]);
  }

  const intervalId = setInterval(print, 150);
  return () => {
    clearInterval(intervalId);
    log([cmd(cmd.DeleteLines, 1), cmd(cmd.ToColumn, 1)]);
  };
}

interface PrintSignal {
  text: string;
}

interface PrintConfig {
  title: string;
  description?: string;
  task(): AsyncIterable<PrintSignal>;
}

export async function print(config: PrintConfig) {
  init();

  printTitle(config.title);
  if (config.description) printLine(config.description);

  printLine();

  let current: PrintSignal | undefined;
  let cancel: (() => void) | undefined;
  try {
    for await (const signal of config.task()) {
      if (cancel) {
        cancel();
      }
      if (current) {
        printCompletedTask(current.text);
        printLine();
      }
      cancel = printRunningTask((current = signal).text);
      await delay();
    }

    if (cancel) {
      cancel();
    }
    if (current) {
      printCompletedTask(current.text, true);
      printLine();
    }

    log([
      Chars.Newline,
      cmd(cmd.Style, [cmd.style.Green, cmd.style.Invert]),
      ' Done ',
      cmd(cmd.Style, cmd.style.NoInvert),
      Chars.Space,
      'You are all set and ready to go.',
    ]);
  } catch (error: any) {
    if (cancel) {
      cancel();
    }

    if (current) {
      printFailedTask(current.text);
    }

    if (error instanceof CLIError) {
      log([
        Chars.Newline,
        cmd(cmd.Style, [cmd.style.BrightRed, cmd.style.Invert]),
        ' Error ',
        cmd(cmd.Style, cmd.style.NoInvert),
        Chars.Newline,
        `${error.output}`,
      ]);
    } else {
      log([
        Chars.Newline,
        cmd(cmd.Style, [cmd.style.BrightRed, cmd.style.Invert]),
        ' Unexpected Error ',
        cmd(cmd.Style, cmd.style.NoInvert),
        Chars.Newline,
        `${error}`,
      ]);
    }
  }
}
