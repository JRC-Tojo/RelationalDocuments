import { describe, expect, it } from 'bun:test';
import { createGenerationGuard } from '../generationGuard';

describe('createGenerationGuard', () => {
  it('start()していない状態では、start()が返し得る値(1以上)はcurrentではない', () => {
    const guard = createGenerationGuard();
    expect(guard.isCurrent(1)).toBe(false);
  });

  it('start()直後は、その世代番号のみがcurrentである', () => {
    const guard = createGenerationGuard();
    const generation = guard.start();
    expect(guard.isCurrent(generation)).toBe(true);
  });

  it('再度start()すると、古い世代はcurrentでなくなり新しい世代のみcurrentになる', () => {
    const guard = createGenerationGuard();
    const first = guard.start();
    const second = guard.start();

    expect(first).not.toBe(second);
    expect(guard.isCurrent(first)).toBe(false);
    expect(guard.isCurrent(second)).toBe(true);
  });

  it('典型的な使い方：後発の実行が完了した後に先発の実行が完了しても、先発側は古い世代のまま', async () => {
    const guard = createGenerationGuard();
    const results: string[] = [];

    async function run(label: string, delayMs: number): Promise<void> {
      const generation = guard.start();
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      if (!guard.isCurrent(generation)) return;
      results.push(label);
    }

    // 先発(遅い)・後発(速い)の順で開始し、後発が先に完了する状況を再現する
    const slow = run('slow', 20);
    const fast = run('fast', 0);
    await Promise.all([slow, fast]);

    // 先発側の結果が後から反映されて上書きすることはない
    expect(results).toEqual(['fast']);
  });
});
