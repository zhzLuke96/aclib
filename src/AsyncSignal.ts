/**
 * Exactly equal to Promise<T> but has resolve/reject methods
 */
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
    return [this.resolve, this.reject] as const;
  }

  get [Symbol.toStringTag]() {
    return "AsyncSignal";
  }
}
