import { AsyncLocalStorage } from "async_hooks";

export class AsyncSignal<T = unknown> extends Promise<T> {
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: Error) => void;

  constructor() {
    let resolve!: (value: T | PromiseLike<T>) => void,
      reject!: (reason?: Error) => void;
    super((res, rej) => ([resolve, reject] = [res, rej]));
    this.resolve = resolve;
    this.reject = reject;
  }

  spread() {
    return [this, this.resolve, this.reject] as const;
  }

  static get [Symbol.species]() {
    return Promise;
  }

  get [Symbol.toStringTag]() {
    return "AsyncSignal";
  }
}

export class AsyncBarrier {
  private promise = Promise.resolve(true) as AsyncSignal;

  /**
   * close barrier
   */
  async close(timeout_ms = -1) {
    await this.promise;
    let opener: () => void = () => void 0;
    this.promise = new AsyncSignal();
    opener = this.promise.resolve as any;

    let timer: any = 0;
    const reset = () => {
      if (timeout_ms < 0) {
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(opener, timeout_ms);
    };
    reset();

    return [opener, reset] as const;
  }
}

type AsyncWindowParams = {
  max_size: number;
  timeout_ms: number;

  hooks?: {
    enter?: () => void;
    leave?: () => void;
  };
};

export class AsyncWindow {
  private params: AsyncWindowParams;
  private _size = 0;
  private queue = [] as AsyncSignal[];
  constructor(params: Partial<AsyncWindowParams>) {
    this.params = { max_size: 5, timeout: -1, ...params } as AsyncWindowParams;
  }

  is_empty() {
    return this._size === 0;
  }

  is_busy() {
    return this._size >= this.params.max_size;
  }

  size() {
    return this._size;
  }

  queue_size() {
    return this.queue.length;
  }

  async enter(onPending?: () => void, onResume?: () => void) {
    this.params.hooks?.enter?.();
    if (this.is_busy()) {
      const signal = new AsyncSignal();
      this.queue.push(signal);
      onPending?.();
      await signal;
      onResume?.();
    }
    this._size += 1;
    let leaved = false;
    const leave = () => {
      if (leaved) {
        return;
      }
      this.params.hooks?.leave?.();
      leaved = true;
      this._size -= 1;
      const signal = this.queue.shift();
      signal?.resolve(void 0);
    };
    let timer: any = 0;
    const reset = () => {
      if (this.params.timeout_ms < 0) {
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(leave, this.params.timeout_ms);
    };
    reset();
    return [leave, reset] as const;
  }
}

type AnyFunc<ARGS extends unknown[], RET> = (...args: ARGS) => RET;
export class AsyncLocker {
  private domain_storage = new AsyncLocalStorage<string[]>();

  private queues = new Map<string, AsyncSignal[]>();

  constructor(readonly reentrant = true) {}

  is_busy(key: string) {
    return this.queues.has(key);
  }

  private queue(key: string) {
    return this.queues.get(key);
  }

  async acquire<ARGS extends unknown[], RET>(
    key: string,
    func: AnyFunc<ARGS, RET>,
    ...args: ARGS
  ): Promise<Awaited<RET>> {
    const domain = this.domain_storage.getStore() || [];
    const domain_included = domain.includes(key);
    domain.push(key);

    if (!this.reentrant && domain_included) {
      throw new Error(
        `this locker is not reentrant, but duplicate acquire [${key}]`
      );
    }

    let queue = this.queue(key);
    const busy = !!queue && !domain_included;

    if (!busy) {
      queue = [];
      this.queues.set(key, queue);
    } else {
      const signal = new AsyncSignal();
      queue?.push(signal);
      await signal;
    }
    const dequeue = () => {
      const signal = queue?.shift();
      if (signal) {
        signal.resolve(void 0);
      } else {
        this.queues.delete(key);
      }
      domain.pop();
    };
    try {
      const [ret] = await Promise.all([
        this.domain_storage.run(domain, () => func(...args)),
      ]);
      dequeue();
      return ret as any;
    } catch (error) {
      dequeue();
      throw error;
    }
  }
}
