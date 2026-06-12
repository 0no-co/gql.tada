import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

class MockWorker extends EventEmitter {
  static instances: MockWorker[] = [];
  messages: unknown[] = [];
  refs = 0;
  unrefs = 0;

  constructor() {
    super();
    MockWorker.instances.push(this);
  }

  ref() {
    this.refs++;
  }

  unref() {
    this.unrefs++;
  }

  postMessage(message: unknown) {
    this.messages.push(message);
  }
}

vi.mock('node:worker_threads', () => ({
  Worker: MockWorker,
  isMainThread: true,
  parentPort: null,
  SHARE_ENV: Symbol('SHARE_ENV'),
}));

describe('threads expose', () => {
  beforeEach(() => {
    MockWorker.instances = [];
  });

  it('keeps the worker referenced while an iterator is active', async () => {
    const { expose } = await import('../index');
    const run = expose(async function* (): AsyncIterableIterator<never> {});
    const iterator = run();

    const next = iterator.next();
    const worker = MockWorker.instances[0];

    expect(worker.refs).toBe(1);

    worker.emit('error', new Error('boom'));
    await expect(next).rejects.toThrow('boom');
    expect(worker.unrefs).toBe(2);
  });

  it('rejects pending pulls when a worker exits before posting a terminal message', async () => {
    const { expose } = await import('../index');
    const run = expose(async function* (): AsyncIterableIterator<never> {});
    const iterator = run();

    const next = iterator.next();
    MockWorker.instances[0].emit('exit', 1);

    await expect(next).rejects.toThrow(/Worker stopped unexpectedly with exit code 1/);
  });

  it('rejects pending pulls with the original worker error', async () => {
    const { expose } = await import('../index');
    const run = expose(async function* (): AsyncIterableIterator<never> {});
    const iterator = run();
    const error = new Error(
      'Worker terminated due to reaching memory limit: JS heap out of memory'
    );

    const next = iterator.next();
    MockWorker.instances[0].emit('error', error);

    await expect(next).rejects.toThrow(/out of memory/i);
  });
});
