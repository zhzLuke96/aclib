import { AsyncSignal } from "./AsyncSignal";

export class AsyncBarrier {
  private signals = [] as AsyncSignal[];
  private running = false;

  constructor(readonly timeout_ms = -1) {
    if (typeof timeout_ms !== "number") {
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

    let timer: NodeJS.Timeout | null = null;
    const reset = () => {
      if (timeout_ms < 0) {
        return;
      }
      timer && clearTimeout(timer);
      timer = setTimeout(() => {
        opener();
        timer = null;
        // TODO maybe need timeout error or timeout callback
      }, timeout_ms);
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

  constructor(
    private readonly DEF_KEY = "default",
    private readonly DEF_TIMEOUT = 0
  ) {}

  private ensure_barrier(key: string, timeout_ms: number) {
    let barrier = this.barriers.get(key);
    if (!barrier) {
      barrier = new AsyncBarrier(timeout_ms);
      this.barriers.set(key, barrier);
    }
    return barrier;
  }

  async close(key = this.DEF_KEY, timeout_ms = this.DEF_TIMEOUT) {
    const barrier = this.ensure_barrier(key, timeout_ms);
    return await barrier.close();
  }
}
