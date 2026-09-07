/**
 * 同じ非同期処理（検索・コンテナツリー読み込み等）が再実行されたとき、
 * 先発の古い実行が後から完了しても現在の状態を上書きしないためのガードを生成する
 *
 * 呼び出し元は実行開始時に`start()`で世代番号を発行して保持し、非同期処理中の各区切り
 * （awaitの直後・進捗コールバック内）で`isCurrent(generation)`を確認してから状態を更新する。
 * `start()`が別の呼び出しにより再度実行されると、それ以前の世代は`isCurrent`がfalseを返すようになる
 */
export function createGenerationGuard() {
  let current = 0;

  return {
    /** 新しい世代を開始し、その世代番号を返す */
    start(): number {
      return ++current;
    },
    /** 指定した世代が現在も最新（＝後続の`start()`で上書きされていない）かどうかを返す */
    isCurrent(generation: number): boolean {
      return generation === current;
    },
  };
}
