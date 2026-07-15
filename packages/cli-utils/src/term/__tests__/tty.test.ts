import { PassThrough } from 'node:stream';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { initTTY } from '../tty';

function mockProcessStreams(isTTY: boolean) {
  const stdin = Object.assign(new PassThrough(), {
    isTTY,
    setRawMode: vi.fn(),
    unref: vi.fn(),
  });
  const stdout = Object.assign(new PassThrough(), { isTTY });
  const stderr = Object.assign(new PassThrough(), { isTTY });

  vi.spyOn(process, 'stdin', 'get').mockReturnValue(stdin as unknown as typeof process.stdin);
  vi.spyOn(process, 'stdout', 'get').mockReturnValue(stdout as unknown as typeof process.stdout);
  vi.spyOn(process, 'stderr', 'get').mockReturnValue(stderr as unknown as typeof process.stderr);

  return { stdin };
}

function pendingOutputs() {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  async function* outputs() {
    await pending;
  }
  return { outputs: outputs(), finish };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('initTTY', () => {
  it('does not subscribe to stdin in non-interactive environments', async () => {
    vi.stubEnv('CI', '1');
    const { stdin } = mockProcessStreams(true);
    const tty = initTTY();
    const { outputs, finish } = pendingOutputs();

    const result = tty.start(outputs);

    expect(tty.isInteractive).toBe(false);
    expect(stdin.listenerCount('keypress')).toBe(0);
    expect(stdin.setRawMode).not.toHaveBeenCalled();

    finish();
    await result;
  });

  it('does not interpret Ctrl-D as a termination request', async () => {
    vi.stubEnv('CI', '');
    vi.stubEnv('TERM', 'xterm');
    const { stdin } = mockProcessStreams(true);
    const exit = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    const tty = initTTY();
    const { outputs, finish } = pendingOutputs();

    const result = tty.start(outputs);
    stdin.emit('keypress', '\x04', {
      sequence: '\x04',
      name: 'd',
      ctrl: true,
      meta: false,
      shift: false,
    });

    expect(exit).not.toHaveBeenCalled();

    finish();
    await result;
  });
});
