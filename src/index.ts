import { AsyncLocalStorage } from "async_hooks";

export class AsyncSignal<T = unknown> extends Promise<T> {
  static all<T extends readonly unknown[] | []>(values: T) {
    return Promise.all(values);
  }

  static race<T extends readonly unknown[] | []>(values: T) {
    return Promise.race(values);
  }

  static any<T>(values: Iterable<T | PromiseLike<T>>) {
    return Promise.any(values);
  }

  static get [Symbol.species]() {
    return Promise;
  }

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

  get [Symbol.toStringTag]() {
    return "AsyncSignal";
  }
}

export class AsyncBarrier {
  private signals = [] as AsyncSignal[];
  private running = false;

  constructor(readonly timeout_ms = -1) {
    if (typeof timeout_ms !== 'number') {
      this.timeout_ms = 0;
    }
  }

  /**
   * close barrier
   */
  async close() {
    const { timeout_ms, running } = this;
    if (running) {
      const signal = new AsyncSignal();
      this.signals.push(signal);
      await signal;
    }
    this.running = true;

    let timer: any = 0;
    const reset = () => {
      if (timeout_ms < 0) {
        return;
      }
      clearTimeout(timer);
      timer = setTimeout(opener, timeout_ms);
    };

    const opener = () => {
      this.running = false;
      const signal = this.signals.shift();
      signal?.resolve(void 0);
    };

    reset();

    return [
      async <RET>(fn?: () => RET) => {
        try {
          const ret = await fn?.();
          opener();
          return ret;
        } catch (error) {
          opener();
          throw error;
        }
      },
      reset,
    ] as const;
  }
}

export class AsyncBarrierSpace {
  private barriers = new Map<string, AsyncBarrier>();

  constructor(readonly DEF_KEY){}

  private ensure_barrier(key = this.DEF_KEY) {
    let barrier = this.barriers.get(key);
    if (!barrier) {
      barrier = new AsyncBarrier();
      this.barriers.set(key, barrier);
    }
    return barrier;
  }

  async close(key = this.DEF_KEY) {
    const barrier = this.ensure_barrier(key);
    return await barrier.close();
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
  constructor(params?: Partial<AsyncWindowParams>) {
    this.params = {
      max_size: 5,
      timeout_ms: -1,
      ...(typeof params === "object" ? params : {}),
    } as AsyncWindowParams;
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

  async enter(
    { on_pending, on_resume } = {} as {
      on_pending?: () => void;
      on_resume?: () => void;
    }
  ) {
    this.params.hooks?.enter?.();
    if (this.is_busy()) {
      const signal = new AsyncSignal();
      this.queue.push(signal);
      on_pending?.();
      await signal;
      on_resume?.();
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

export class AsyncWindowSpace {
  private windows = new Map<string, AsyncWindow>();

  constructor(readonly DEF_KEY = "") {}

  private ensure_window(key: string, params?: AsyncWindowParams) {
    let window = this.windows.get(key);
    if (!window) {
      window = new AsyncWindow(params);
      this.windows.set(key, window);
    }
    return window;
  }

  private get_window(key = this.DEF_KEY) {
    return this.windows.get(key);
  }

  is_empty(key = this.DEF_KEY) {
    return !!this.get_window(key)?.is_empty();
  }

  is_busy(key = this.DEF_KEY) {
    return !!this.get_window(key)?.is_busy();
  }

  size(key = this.DEF_KEY) {
    return this.get_window(key)?.size() || 0;
  }

  queue_size(key = this.DEF_KEY) {
    return this.get_window(key)?.queue_size() || 0;
  }

  async enter(
    key = this.DEF_KEY,
    { on_pending, on_resume, params } = {} as {
      on_pending?: () => void;
      on_resume?: () => void;
      params?: AsyncWindowParams;
    }
  ) {
    const window = this.ensure_window(key, params);
    return window.enter({ on_pending, on_resume });
  }
}

class SymbolMap<VALUE> {
  private smap = new Map<keyof any, VALUE>();
  private wmap = new WeakMap<Object, VALUE>();

  private is_ref_key(key: any) {
    return typeof key !== 'string' && !(key instanceof String) && typeof key !== 'number' && !(key instanceof Number) && typeof key !== 'symbol' && typeof key !== 'boolean';
  }

  has(key: any) {
    if (this.is_ref_key(key)) {
      return this.wmap.has(key);
    }
    return this.smap.has(key);
  }

  get(key: any) {
    if (this.is_ref_key(key)) {
      return this.wmap.get(key);
    }
    return this.smap.get(key);
  }

  set(key: any, val: VALUE) {
    if (this.is_ref_key(key)) {
      return this.wmap.set(key, val);
    }
    return this.smap.set(key, val);
  }

  del(key: any) {
    if (this.is_ref_key(key)) {
      return this.wmap.get(key);
    }
    return this.smap.get(key);
  }
}

type AnyFunc<ARGS extends unknown[], RET> = (...args: ARGS) => RET;
export class AsyncLocker {
  static AsyncLockerReentrantError = class AsyncLockerReentrantError extends Error {};

  private domain_storage = new AsyncLocalStorage<string[]>();

  private queues = new SymbolMap<AsyncSignal[]>();

  constructor(readonly reentrant = true) {}

  is_busy(key: any) {
    return this.queues.has(key);
  }

  private queue(key: any) {
    return this.queues.get(key);
  }

  async acquire<ARGS extends unknown[], RET>(
    key: any,
    func?: AnyFunc<ARGS, RET>,
    ...args: ARGS
  ): Promise<Awaited<RET>> {
    const domain = this.domain_storage.getStore() || [];
    const domain_included = domain.includes(key);
    domain.push(key);

    if (!this.reentrant && domain_included) {
      throw new AsyncLocker.AsyncLockerReentrantError(
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
        this.queues.del(key);
      }
      domain.pop();
    };
    try {
      const [ret] = await Promise.all([
        this.domain_storage.run(domain, () => func?.(...args)),
      ]);
      dequeue();
      return ret as any;
    } catch (error) {
      dequeue();
      throw error;
    }
  }
}
