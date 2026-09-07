/**
 * 動的に追加されるタスクであっても同時実行数を一定数までに抑えられる共有リミッターを生成する
 *
 * `runConcurrently`は呼び出し時点で確定した固定のタスク列にしか対応できないため、複数の
 * 呼び出し元がそれぞれ非同期にタスクを積んでいく場面（例: コンテナ横断検索でコンテナ単位の
 * 処理を並列実行しつつ、全コンテナ合計の文書検索本数は一定数までに抑えたい場合）には使えない。
 * 返す`schedule`関数はタスクをキューへ積み、`concurrency`件までしか同時実行しない
 */
export function createConcurrencyLimiter(
  concurrency: number,
): <T>(task: () => Promise<T>) => Promise<T> {
  let active = 0;
  const queue: (() => void)[] = [];

  const dequeue = (): void => {
    if (active >= concurrency || queue.length === 0) return;
    active++;
    const run = queue.shift()!;
    run();
  };

  return function schedule<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        task()
          .then(resolve, reject)
          .finally(() => {
            active--;
            dequeue();
          });
      });
      dequeue();
    });
  };
}

/**
 * 指定されたタスクを指定された並列数で実行する
 */
export async function runConcurrently<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number,
): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let nextIndex = 0;

  const worker = async (): Promise<void> => {
    while (nextIndex < tasks.length) {
      const index = nextIndex++;
      results[index] = await tasks[index]!();
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker()));

  return results;
}
