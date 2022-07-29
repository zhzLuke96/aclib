import {AsyncBarrier, AsyncBarrierSpace} from './AsyncBarrier'

describe('AsyncBarrier tests', () => {
  it('constructor', () => {
    const ab1 = new AsyncBarrier();
    const ab2 = new AsyncBarrier(1);
    const ab3 = new AsyncBarrier('' as any);
  });
  it('simple close case', async () => {
    const barrier = new AsyncBarrier();

    try {
      const [opener, reset] = await barrier.close();
      expect(opener).toBeInstanceOf(Function);
      expect(reset).toBeInstanceOf(Function);
    } catch (error) {
      expect(error).not.toMatch('error');
    }
  });

  it('opener call', async () => {
    const barrier = new AsyncBarrier();

    try {
      const [opener] = await barrier.close();
      const nextP = barrier.close();
      setTimeout(opener);
      await nextP;
    } catch (error) {
      expect(error).not.toMatch('error');
    }
  });

  it('timeout', async () => {
    const barrier = new AsyncBarrier(1);

    try {
      await barrier.close();
      await barrier.close();
      await barrier.close();
      await barrier.close();
    } catch (error) {
      expect(error).not.toMatch('error');
    }
  });

  it('timeout reset', async () => {
    const barrier = new AsyncBarrier(1000);

    const start_time = Date.now();
    try {
      const [, reset] = await barrier.close();
      setTimeout(reset, 500);
      setTimeout(reset, 1000);
      setTimeout(reset, 1500);
      setTimeout(reset, 2000);
      await barrier.close();
      const cast_time = Date.now() - start_time;
      expect(cast_time).toBeGreaterThan(1005);
    } catch (error) {
      expect(error).not.toMatch('error');
    }
  });

  it('Error reporting in opener does not prevent later programs from running', async () => {
    const barrier = new AsyncBarrier(1);

    const [opener] = await barrier.close();
    const p = barrier.close();
    try {
      await opener(() => {
        throw new Error();
      });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
    }
    const [opener2] = await p;
    // must can go here
    expect(opener2).toBeInstanceOf(Function);
  })
})


describe('AsyncBarrierSpace tests', () => {
  it('simple case', async () => {
    const abspace = new AsyncBarrierSpace();

    try {
      const [opener1, reset1] = await abspace.close();
      expect(opener1).toBeInstanceOf(Function);
      expect(reset1).toBeInstanceOf(Function);
      opener1();
      const [opener2, reset2] = await abspace.close();
      expect(opener2).toBeInstanceOf(Function);
      expect(reset2).toBeInstanceOf(Function);
    } catch (error) {
      expect(error).not.toMatch('error');
    }
  });
});
