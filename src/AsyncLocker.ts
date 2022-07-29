import { AsyncLocalStorage } from "async_hooks";
import { AsyncSignal } from "./AsyncSignal";

/**
 * The key can be a string, a number, a symbol, or a reference to an object
 */
class SymbolMap<VALUE> {
  private smap = new Map<keyof any, VALUE>();
  private wmap = new WeakMap<Object, VALUE>();

  private is_ref_key(key: any) {
    return (
      typeof key === "object" &&
      typeof key !== "string" &&
      !(key instanceof String) &&
      typeof key !== "number" &&
      !(key instanceof Number) &&
      typeof key !== "symbol" &&
      typeof key !== "boolean"
    );
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

class AsyncLockerReentrantError extends Error {}
class AsyncLockerKeyError extends Error {}

type AnyFunc<ARGS extends unknown[], RET> = (...args: ARGS) => RET;
export class AsyncLocker {
  static AsyncLockerReentrantError = AsyncLockerReentrantError;
  static AsyncLockerKeyError = AsyncLockerKeyError;

  private domain_storage = new AsyncLocalStorage<string[]>();

  private queues = new SymbolMap<AsyncSignal[]>();

  constructor(readonly reentrant = true) {}

  is_busy(key: any) {
    if (typeof key === 'boolean') {
      throw new AsyncLockerKeyError('acquire key must not be boolean type');
    }
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
    if (typeof key === 'boolean') {
      throw new AsyncLockerKeyError('acquire key must not be boolean type');
    }

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