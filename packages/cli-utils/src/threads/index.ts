import type { WorkerOptions } from 'node:worker_threads';
import { Worker, isMainThread, parentPort, SHARE_ENV } from 'node:worker_threads';

const port = parentPort!;
if (!isMainThread && !port) {
  throw new ReferenceError('Failed to receive parent message port');
}

const enum MainMessageCodes {
  Start = 'START',
  Close = 'CLOSE',
  Pull = 'PULL',
}

interface MainMessage {
  id?: number;
  kind: MainMessageCodes;
  data?: any;
}

const enum ThreadMessageCodes {
  Next = 'NEXT',
  Throw = 'THROW',
  Return = 'RETURN',
}

interface ThreadMessage {
  id?: number;
  kind: ThreadMessageCodes;
  data?: any;
}

const workerOpts: WorkerOptions = {
  env: SHARE_ENV,
  stderr: false,
  stdout: false,
  stdin: false,
};

const asyncIteratorSymbol = (): typeof Symbol.asyncIterator =>
  (typeof Symbol === 'function' && Symbol.asyncIterator) || ('@@asyncIterator' as any);

/** Capture the stack above the caller */
function captureStack(): NodeJS.CallSite[] {
  const _error: any = new Error();
  const _prepareStackTrace = Error.prepareStackTrace;
  try {
    let stack: NodeJS.CallSite[] | undefined;
    Error.prepareStackTrace = (_error, _stack) => (stack = _stack);
    Error.captureStackTrace(_error);
    if (!_error.stack) throw _error;
    return (stack && stack.slice(2)) || [];
  } finally {
    Error.prepareStackTrace = _prepareStackTrace;
  }
}

export interface Generator<Args extends readonly any[], Next> {
  // TODO: Update to support for AsyncGenerator interface
  (...args: Args): AsyncIterableIterator<Next>;
}

function main<Args extends readonly any[], Next>(url: string | URL): Generator<Args, Next> {
  let worker: Worker;
  let ids = 0;
  return (...args: Args) => {
    if (!worker) {
      worker = new Worker(url, workerOpts);
      worker.unref();
    }

    const id = ++ids | 0;
    const buffer: ThreadMessage[] = [];

    let started = false;
    let ended = false;
    let pulled = false;
    let resolve: ((value: IteratorResult<Next>) => void) | void;
    let reject: ((error: any) => void) | void;

    function cleanup() {
      ended = true;
      resolve = undefined;
      reject = undefined;
      worker.removeListener('message', receiveMessage);
      worker.removeListener('error', receiveError);
    }

    function sendMessage(kind: MainMessageCodes) {
      worker.postMessage({ id, kind });
    }

    function receiveError(error: any) {
      cleanup();
      buffer.length = 1;
      buffer[0] = {
        id,
        kind: ThreadMessageCodes.Throw,
        data: error,
      };
    }

    function receiveMessage(data: unknown) {
      const message: ThreadMessage | null =
        data && typeof data === 'object' && 'kind' in data ? (data as ThreadMessage) : null;
      if (!message) {
        return;
      } else if (reject && message.kind === ThreadMessageCodes.Throw) {
        reject(message.data);
        cleanup();
      } else if (resolve && message.kind === ThreadMessageCodes.Return) {
        resolve({ done: true, value: message.data });
        cleanup();
      } else if (resolve && message.kind === ThreadMessageCodes.Next) {
        pulled = false;
        resolve({ done: false, value: message.data });
      } else if (
        message.kind === ThreadMessageCodes.Throw ||
        message.kind === ThreadMessageCodes.Return
      ) {
        buffer.push(message);
        cleanup();
      } else if (message.kind === ThreadMessageCodes.Next) {
        buffer.push(message);
        pulled = false;
      }
    }

    return {
      async next() {
        if (!started) {
          started = true;
          worker.addListener('message', receiveMessage);
          worker.addListener('error', receiveError);
          worker.postMessage({
            id,
            kind: MainMessageCodes.Start,
            data: args,
          });
        }
        if (ended && !buffer.length) {
          return { done: true } as IteratorReturnResult<any>;
        } else if (!ended && !pulled && buffer.length <= 1) {
          pulled = true;
          sendMessage(MainMessageCodes.Pull);
        }
        const message = buffer.shift();
        if (message && message.kind === ThreadMessageCodes.Throw) {
          cleanup();
          throw message.data;
        } else if (message && message.kind === ThreadMessageCodes.Return) {
          cleanup();
          return { value: message.data, done: true };
        } else if (message && message.kind === ThreadMessageCodes.Next) {
          return { value: message.data, done: false };
        } else {
          return new Promise((_resolve, _reject) => {
            resolve = (value) => {
              resolve = undefined;
              reject = undefined;
              _resolve(value);
            };
            reject = (error) => {
              resolve = undefined;
              reject = undefined;
              _reject(error);
            };
          });
        }
      },
      async return() {
        if (!ended) {
          cleanup();
          sendMessage(MainMessageCodes.Close);
        }
        return { done: true } as IteratorReturnResult<any>;
      },
      [asyncIteratorSymbol()]() {
        return this;
      },
    };
  };
}

function thread<Args extends readonly any[], Next>(
  message: MainMessage,
  generator: Generator<Args, Next>
): void {
  if (message.kind !== MainMessageCodes.Start) return;
  const id = message.id;
  const iterator = generator(...(message.data as any));

  let ended = false;
  let pulled = false;
  let looping = false;

  function cleanup() {
    ended = true;
    port.removeListener('message', receiveMessage);
  }

  async function sendMessage(kind: ThreadMessageCodes, data?: any) {
    try {
      port.postMessage({ id, kind, data });
    } catch (error) {
      cleanup();
      if (iterator.throw) {
        let result = await iterator.throw();
        if (result.done === false && iterator.return) {
          result = await iterator.return();
          sendMessage(ThreadMessageCodes.Return, result.value);
        } else {
          sendMessage(ThreadMessageCodes.Return, result.value);
        }
      } else {
        sendMessage(ThreadMessageCodes.Return);
      }
    }
  }

  async function receiveMessage(data: unknown) {
    const message: MainMessage | null =
      data && typeof data === 'object' && 'kind' in data ? (data as MainMessage) : null;
    let next: IteratorResult<Next>;
    if (!message) {
      return;
    } else if (message.kind === MainMessageCodes.Close) {
      cleanup();
      if (iterator.return) iterator.return();
    } else if (message.kind === MainMessageCodes.Pull && looping) {
      pulled = true;
    } else if (message.kind === MainMessageCodes.Pull) {
      for (pulled = looping = true; pulled && !ended; ) {
        try {
          if ((next = await iterator.next()).done) {
            cleanup();
            if (iterator.return) next = await iterator.return();
            sendMessage(ThreadMessageCodes.Return, next.value);
          } else {
            pulled = false;
            sendMessage(ThreadMessageCodes.Next, next.value);
          }
        } catch (error) {
          cleanup();
          sendMessage(ThreadMessageCodes.Throw, error);
        }
      }
      looping = false;
    }
  }

  port.addListener('message', receiveMessage);
}

export function expose<Args extends readonly any[], Return>(
  generator: Generator<Args, Return>
): Generator<Args, Return> {
  if (isMainThread) {
    const call = captureStack()[0];
    const file = call && call.getFileName();
    if (!file) throw new ReferenceError('Captured stack trace is empty');
    const url = file.startsWith('file://') ? new URL(file) : file;
    return main(url);
  } else {
    port.addListener('message', (data) => {
      const message: MainMessage | null =
        data && typeof data === 'object' && 'kind' in data ? (data as MainMessage) : null;
      if (message) thread(message, generator);
    });
    return generator;
  }
}
