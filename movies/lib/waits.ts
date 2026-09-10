/** 指定ミリ秒だけ待つ。演出の間（ま）を作るためだけの単純なユーティリティ */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * アプリ側の未知の不具合・想定外のダイアログ挙動などで処理が返ってこなくなった場合に、
 * テスト全体のタイムアウト（20分）を丸ごと消費してしまわないようにするための保険。
 * 個々のPlaywright操作のタイムアウトだけでは防げない「複数操作の組み合わせによるハング」を
 * 一定時間で切り上げ、原因箇所を特定しやすい短いエラーに変換する
 */
export async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`movies: 「${label}」が${ms}ms以内に完了しませんでした`)),
      ms,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}
