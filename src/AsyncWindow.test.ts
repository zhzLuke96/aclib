import {AsyncWindow} from './index';

describe('AsyncWindow tests', () => {
  it('constructor', async () => {
    try {
      const w1 = new AsyncWindow();
      const w2 = new AsyncWindow({});
      const w3 = new AsyncWindow(1 as any);
      const w4 = new AsyncWindow({timeout_ms: 1});
    } catch (error) {
      expect(error).not.toMatch('error');
    }
  });
  it('window status', async () => {
    const w1 = new AsyncWindow({max_size: 2});

    expect(w1.is_busy()).toBe(false);
    expect(w1.is_empty()).toBe(true);
    expect(w1.size()).toBe(0);
    expect(w1.queue_size()).toBe(0);

    const [leave] = await w1.enter();

    expect(w1.is_busy()).toBe(false);
    expect(w1.is_empty()).toBe(false);
    expect(w1.size()).toBe(1);
    expect(w1.queue_size()).toBe(0);

    const p1 = w1.enter();
    const p2 = w1.enter();

    expect(w1.is_busy()).toBe(true);
    expect(w1.is_empty()).toBe(false);
    expect(w1.size()).toBe(2);
    expect(w1.queue_size()).toBe(1);

    leave();
    {
      const [leave] = await p1;
      leave();
    }
    {
      const [leave] = await p2;
      leave();
    }

    expect(w1.is_busy()).toBe(false);
    expect(w1.is_empty()).toBe(true);
    expect(w1.size()).toBe(0);
    expect(w1.queue_size()).toBe(0);
  });

  it('timeout setting', async () => {
    const w1 = new AsyncWindow({max_size: 2, timeout_ms: 1});
    try {
      await w1.enter();
      await w1.enter();
      await w1.enter();
      await w1.enter();
    } catch (error) {
      expect(error).not.toMatch('error');
    }
  });

  it('timeout reset', async () => {
    const w1 = new AsyncWindow({timeout_ms: 1000,max_size: 2});

    const start_time = Date.now();
    await w1.enter();
    await w1.enter();
    const [, reset] = await w1.enter();
    setTimeout(reset, 500);
    setTimeout(reset, 1000);
    await w1.enter();
    await w1.enter();
    const cast_time = Date.now() - start_time;
    expect(cast_time).toBeGreaterThan(1500);
  });
});


describe('AsyncWindowSpace tests', () => {
  it('TODO', async () => {
    // TODO
  });
});
