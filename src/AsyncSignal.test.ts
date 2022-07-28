import {
  AsyncSignal
} from "./index";

describe("AsyncSignal test", () => {
  it("AsyncSignal instanceof Promise", async () => {
    const signal = new AsyncSignal();

    expect(signal instanceof Promise).toBe(true);
  });
  it("Promise then", async () => {
    const signal = new AsyncSignal();

    setTimeout(signal.resolve);
    const next = await signal.then(() => 22);
    expect(next).toBe(22);
  });
  it("Promise catch", async () => {
    const signal = new AsyncSignal();

    setTimeout(signal.resolve);
    await signal
      .then(() => Promise.reject(22))
      .catch((err) => expect(err).toBe(22));
  });
  it("Promise all", async () => {
    const signals = [new AsyncSignal<number>(),new AsyncSignal<number>(),new AsyncSignal<number>()];

    setTimeout(() => {
      signals.forEach(sig => sig.resolve(1));
    })
    const resolved = await AsyncSignal.all(signals);

    expect(resolved).toEqual([1,1,1]);
  });
  it("Promise race", async () => {
    const signals = [new AsyncSignal<number>(),new AsyncSignal<number>(),new AsyncSignal<number>()];

    setTimeout(() => {
      signals[2].resolve(2);
    }, 1);
    setTimeout(() => {
      signals[1].resolve(1);
      signals[0].resolve(1);
    }, 1000)
    const resolved = await AsyncSignal.race(signals);

    expect(resolved).toEqual(2);
  });
  it("Promise race", async () => {
    const signals = [new AsyncSignal<number>(),new AsyncSignal<number>(),new AsyncSignal<number>()];

    setTimeout(() => {
      signals[2].resolve(2);
    }, 1);
    setTimeout(() => {
      signals[1].resolve(1);
      signals[0].resolve(1);
    }, 1000)
    const resolved = await AsyncSignal.race(signals);

    expect(resolved).toEqual(2);
  });
  it("Promise any, success", async () => {
    const signals = [new AsyncSignal<number>(),new AsyncSignal<number>(),new AsyncSignal<number>()];

    const aErr = new Error();
    setTimeout(() => {
      signals[2].reject(aErr);
      signals[1].reject(aErr);
    }, 1);
    setTimeout(() => {
      signals[0].resolve(1);
    }, 1000)
    const resolved = await AsyncSignal.any(signals);

    expect(resolved).toEqual(1);
  });
  it("Promise any, all fail", async () => {
    const signals = [new AsyncSignal<number>(),new AsyncSignal<number>(),new AsyncSignal<number>()];

    const aErr = new Error();
    setTimeout(() => {
      signals[2].reject(aErr);
      signals[1].reject(aErr);
    }, 1);
    setTimeout(() => {
      signals[0].reject(aErr);
    }, 1000)

    try {
      await AsyncSignal.any(signals);
      // not here
      expect(1).toBe(0);
    } catch (error) {
      expect(error).toBeInstanceOf(AggregateError);
    }
  });
  it("AsyncSignal resolve", async () => {
    const signal = new AsyncSignal();

    setTimeout(signal.resolve, 1);
    await signal;
    // test can go here
    expect(1).toBe(1);
  });
  it("AsyncSignal reject", async () => {
    const signal = new AsyncSignal();

    const err = new Error('AsyncSignal Rejected');
    setTimeout(() => {
      signal.reject(err);
    }, 1);

    try {
      await signal;
    } catch (error) {
      expect(error).toEqual(err);
    }
  });
});
