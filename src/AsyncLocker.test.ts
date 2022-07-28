import { AsyncLocker } from "./index";

const randomDelay = () =>
  new Promise((r) => setTimeout(r, 100 * Math.random()));

describe("AsyncLocker tests", () => {
  it("simple case", async () => {
    const locker = new AsyncLocker();

    let name = "zhzluke96";
    locker.acquire("name", async () => {
      await randomDelay();
      name = name.toUpperCase();
    });
    locker.acquire("name", async () => {
      await randomDelay();
      name += "_pro";
    });
    await locker.acquire("name");
    expect(name).toEqual("ZHZLUKE96_pro");
  });

  it("when acquire not finish, locker should be busy", () => {
    const locker = new AsyncLocker();

    locker.acquire("name", async () => {
      await new Promise((r) => setTimeout(r, 1000));
    });

    expect(locker.is_busy("name")).toBe(true);
    expect(locker.is_busy("other")).toBe(false);
  });

  it("array patch case", async () => {
    const locker = new AsyncLocker();
    const arr1 = [] as number[];

    const async_patch = async (n: number) => {
      await randomDelay();
      arr1.push(n);
    };
    for (let idx = 0; idx < 10; idx++) {
      locker.acquire("arr1", async_patch, idx);
    }

    await locker.acquire("arr1");
    expect(arr1).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("acquire symbol key", async () => {
    const locker = new AsyncLocker();
    const arr1 = [] as number[];
    const async_patch = async (n: number) => {
      await randomDelay();
      arr1.push(n);
    };
    const LEN = 10;
    for (let idx = 0; idx < LEN; idx++) {
      locker.acquire(arr1, async_patch, idx);
    }
    await locker.acquire(arr1);
    expect(arr1.length).toEqual(LEN);
  });

  it("locker reentrant", async () => {
    const locker = new AsyncLocker();

    let name = "zhzluke96";
    locker.acquire("name", async () => {
      await randomDelay();
      name = name.toUpperCase();
      await locker.acquire("name", async () => {
        await randomDelay();
        name += "_pro";
      });
      await locker.acquire("name", async () => {
        await randomDelay();
        name = name.replace("96", "");
      });
    });
    await locker.acquire("name");
    expect(name).toEqual("ZHZLUKE_pro");
  });

  it("locker reentrant error", async () => {
    const locker = new AsyncLocker(false);

    try {
      let name = "zhzluke96";
      await locker.acquire("name", async () => {
        name = name.toUpperCase();
        await locker.acquire("name", async () => {
          name += "_pro";
        });
      });
      await locker.acquire("name");
    } catch (error) {
      expect(error).toBeInstanceOf(AsyncLocker.AsyncLockerReentrantError);
    }
  });
});
