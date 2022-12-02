import { AsyncSignal } from "./AsyncSignal";

class CloseError extends Error {
  constructor() {
    super("channel is closed");
  }
}

/**
 * communicating sequential processes
 */
export class AsyncChannel<T = unknown> {
  static CloseError = CloseError;

  private buffer_queue = [] as AsyncSignal<T>[];
  private send_queue = [] as AsyncSignal[];
  private recv_queue = [] as AsyncSignal<T>[];

  private _closed = false;

  constructor(readonly buffer_max_size = 0) {
    if (typeof this.buffer_max_size !== "number") {
      this.buffer_max_size = 0;
    }
  }

  close() {
    this._closed = true;
    this.buffer_queue = [];
    this.send_queue = [];
    this.recv_queue = [];
  }

  is_busy() {
    return this.buffer_queue.length >= this.buffer_max_size;
  }

  is_empty() {
    return this.buffer_queue.length === 0;
  }

  is_closed() {
    return this._closed;
  }

  async send(val: T) {
    if (this._closed) {
      throw new AsyncChannel.CloseError();
    }

    const buffer = new AsyncSignal<T>();
    buffer.resolve(val);

    // eslint-disable-next-line no-constant-condition
    while (1) {
      const receiver = this.recv_queue.shift();
      if (receiver) {
        receiver.resolve(buffer);
        return;
      }

      if (this.is_busy()) {
        const send_signal = new AsyncSignal();
        this.send_queue.push(send_signal);
        await send_signal;
      } else {
        this.buffer_queue.push(buffer);
        return;
      }
    }
  }

  recv(): AsyncSignal<T> {
    if (this._closed) {
      throw new AsyncChannel.CloseError();
    }

    let ret: AsyncSignal<T>;
    const buffer = this.buffer_queue.shift();
    if (buffer) {
      ret = buffer;
    } else {
      const recv_signal = new AsyncSignal<T>();
      this.recv_queue.push(recv_signal);
      ret = recv_signal;
    }
    const send_signal = this.send_queue.shift();
    send_signal?.resolve(void 0);
    return ret;
  }
}
