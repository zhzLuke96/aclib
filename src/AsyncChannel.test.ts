import { AsyncChannel } from "./AsyncChannel";
import { NotHere } from "./misc.test";

describe("AsyncChannel tests", () => {
  it("constructor", async () => {
    try {
      const ch1 = new AsyncChannel();
      const ch2 = new AsyncChannel("" as any);
      const ch3 = new AsyncChannel(64);
    } catch (error) {
      expect(error).not.toMatch("error");
    }
  });

  it("zero size channel, must be busy", async () => {
    const ch1 = new AsyncChannel(0);
    expect(ch1.is_busy()).toBe(true);
    expect(ch1.is_empty()).toBe(true);
  });

  it("simple case", async () => {
    const ch1 = new AsyncChannel<number>();

    const arr1 = [] as number[];
    ch1.send(3);
    ch1.send(2);
    ch1.send(1);
    arr1.push(await ch1.recv());
    arr1.push(await ch1.recv());
    arr1.push(await ch1.recv());

    expect(arr1).toEqual([3, 2, 1]);
  });

  it("simple case, with buffer", async () => {
    const ch1 = new AsyncChannel<number>(3);

    const arr1 = [] as number[];
    await ch1.send(3);
    await ch1.send(2);
    await ch1.send(1);

    expect(ch1.is_busy()).toBe(true);
    ch1.send(4);

    arr1.push(await ch1.recv());
    arr1.push(await ch1.recv());
    arr1.push(await ch1.recv());
    arr1.push(await ch1.recv());

    expect(ch1.is_busy()).toBe(false);
    expect(arr1).toEqual([3, 2, 1, 4]);
  });

  it("Calling a closed AsyncChannel should throw error", async () => {
    const ch1 = new AsyncChannel();
    ch1.close();
    try {
      await ch1.send(1);
      NotHere();
    } catch (error) {
      expect(error).toBeInstanceOf(AsyncChannel.CloseError);
    }
    try {
      await ch1.recv();
      NotHere();
    } catch (error) {
      expect(error).toBeInstanceOf(AsyncChannel.CloseError);
    }
  });
});
