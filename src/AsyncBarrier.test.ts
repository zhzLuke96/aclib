import {AsyncBarrier} from './index'

describe('AsyncBarrier tests', () => {
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
})


describe('AsyncBarrierSpace tests', () => {
  it('TODO', async () => {
    // TODO
  });
});
