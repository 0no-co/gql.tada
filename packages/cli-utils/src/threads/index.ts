import type { WorkerOptions } from 'node:worker_threads';
import { Worker, isMainThread, parentPort, SHARE_ENV } from 'node:worker_threads';

let ids = 0;

const port = parentPort!;
if (!isMainThread && !port) {
  throw new ReferenceError('Failed to receive parent message port');
}

const enum MainMessageCodes {
  Start = 10,
  Close,
  Pull,
}

interface MainMessage {
  id?: number;
  kind: MainMessageCodes;
  data?: any;
}

const enum ThreadMessageCodes {
  Next = 20,
  Throw,
  Return,
}

interface ThreadMessage {
  id?: number;
  kind: ThreadMessageCodes;
  data?: any;
}

const workerOpts: WorkerOptions = {
  env: SHARE_ENV,
};

const asyncIteratorSymbol = (): typeof Symbol.asyncIterator =>
  (typeof Symbol === 'function' && Symbol.asyncIterator) || ('@@asyncIterator' as any);

/** Capture the stack above the caller */
function captureStack(): NodeJS.CallSite[] {
  const _error = new Error();
  const _prepareStackTrace = Error.prepareStackTrace;
  try {
    let stack: NodeJS.CallSite[] | undefined;
    Error.prepareStackTrace = (_error, _stack) => (stack = _stack);
    Error.captureStackTrace(_error);
    void _error.stack;
    return (stack && stack.slice(2)) || [];
  } finally {
    Error.prepareStackTrace = _prepareStackTrace;
  }
}

interface Generator<Args extends readonly any[], Next> {
  (...args: Args): AsyncIterator<Next>;
}

function main<Args extends readonly any[], Next>(worker: Worker): Generator<Args, Next> {
  return (...args: Args) => {
    const id = ++ids | 0;
    const buffer: ThreadMessage[] = [];

    let started = false;
    let ended = false;
    let pulled = false;
    let resolve: ((value: IteratorResult<Next>) => void) | void;
    let reject: ((error: any) => void) | void;

    function sendMessage(kind: MainMessageCodes) {
      worker.postMessage({ id, kind });
    }

    function receiveMessage(data: unknown) {
      const message: ThreadMessage | null =
        data && typeof data === 'object' && 'kind' in data ? (data as ThreadMessage) : null;
      if (!message) {
        return;
      } else if (reject && message.kind === ThreadMessageCodes.Throw) {
        ended = true;
        reject(message.data);
      } else if (resolve && message.kind === ThreadMessageCodes.Return) {
        ended = true;
        resolve({ done: true, value: message.data });
      } else if (resolve && message.kind === ThreadMessageCodes.Next) {
        resolve({ done: false, value: message.data });
      } else if (
        message.kind === ThreadMessageCodes.Throw ||
        message.kind === ThreadMessageCodes.Return
      ) {
        ended = true;
        port.removeListener('message', receiveMessage);
        buffer.push(message);
      } else if (message.kind === ThreadMessageCodes.Next) {
        buffer.push(message);
      }
    }

    return {
      async next() {
        if (!started) {
          started = true;
          port.addListener('message', receiveMessage);
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
          ended = true;
          port.removeListener('message', receiveMessage);
          throw message.data;
        } else if (message && message.kind === ThreadMessageCodes.Return) {
          ended = true;
          port.removeListener('message', receiveMessage);
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
          ended = true;
          port.removeListener('message', receiveMessage);
          sendMessage(MainMessageCodes.Close);
          resolve = undefined;
          reject = undefined;
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
  const iterator = generator(...(message.data as any));
  const id = message.id;

  let ended = false;
  let pulled = false;
  let looping = false;

  async function sendMessage(kind: ThreadMessageCodes, data?: any) {
    try {
      port.postMessage({ id, kind, data });
    } catch (error) {
      ended = true;
      port.removeListener('message', receiveMessage);
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
      ended = true;
      port.removeListener('message', receiveMessage);
      if (iterator.return) iterator.return();
    } else if (message.kind === MainMessageCodes.Pull && looping) {
      pulled = true;
    } else if (message.kind === MainMessageCodes.Pull) {
      for (pulled = looping = true; pulled && !ended; ) {
        try {
          if ((next = await iterator.next()).done) {
            ended = true;
            if (iterator.return) next = await iterator.return();
            port.removeListener('message', receiveMessage);
            sendMessage(ThreadMessageCodes.Return, next.value);
          } else {
            pulled = false;
            sendMessage(ThreadMessageCodes.Next, next.value);
          }
        } catch (error) {
          ended = true;
          port.removeListener('message', receiveMessage);
          sendMessage(ThreadMessageCodes.Throw, error);
        }
      }
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
    const worker = new Worker(url, workerOpts);
    return main(worker);
  } else {
    port.addListener('message', (data) => {
      const message: MainMessage | null =
        data && typeof data === 'object' && 'kind' in data ? (data as MainMessage) : null;
      if (message) thread(message, generator);
    });
    return generator;
  }
}
