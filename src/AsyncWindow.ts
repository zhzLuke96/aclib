import { AsyncSignal } from "./AsyncSignal";

type AsyncWindowParams = {
  max_size: number;
  timeout_ms: number;

  hooks?: {
    enter?: () => void;
    leave?: () => void;
  };
};

/**
 * Limit some code runs and control the amount of parallelism
 */
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

    // max_size must greater then 1
    this.params.max_size = Math.max(1, this.params.max_size);
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

  /**
   * enter window
   * @returns[0] leave window
   * @returns[1] reset window timeout
   */
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
    let timer: NodeJS.Timeout | null = null;
    const reset = () => {
      if (this.params.timeout_ms < 0) {
        return;
      }
      timer && clearTimeout(timer);
      timer = setTimeout(() => {
        leave();
        timer = null;
      }, this.params.timeout_ms);
    };
    reset();
    return [leave, reset] as const;
  }
}

export class AsyncWindowSpace {
  private windows = new Map<string, AsyncWindow>();

  constructor(
    readonly DEF_KEY = "default",
    readonly DEF_PARAMS = {} as Partial<AsyncWindowParams>
  ) {}

  ensure_window(key = this.DEF_KEY, params = this.DEF_PARAMS) {
    let window = this.windows.get(key);
    if (!window) {
      window = new AsyncWindow(params);
      this.windows.set(key, window);
    }
    return window;
  }

  is_empty(key = this.DEF_KEY) {
    return this.ensure_window(key).is_empty();
  }

  is_busy(key = this.DEF_KEY) {
    return this.ensure_window(key).is_busy();
  }

  size(key = this.DEF_KEY) {
    return this.ensure_window(key).size();
  }

  queue_size(key = this.DEF_KEY) {
    return this.ensure_window(key).queue_size();
  }

  /**
   * enter window
   * @returns[0] leave window
   * @returns[1] reset window timeout
   */
  async enter(
    key = this.DEF_KEY,
    { on_pending, on_resume } = {} as {
      on_pending?: () => void;
      on_resume?: () => void;
    }
  ) {
    const window = this.ensure_window(key);
    return window.enter({ on_pending, on_resume });
  }
}
