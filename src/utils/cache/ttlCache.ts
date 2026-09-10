/**
 * 短時間だけ値を使い回すための汎用TTL（Time To Live）キャッシュ
 *
 * 「同じキーへの短時間の連続アクセスでは重い処理（ディスクI/O・base64変換等）を省略したいが、
 * 外部要因での更新を長時間見逃さないよう恒久的にはキャッシュしたくない」という場面
 * （`services/container/main.ts`の`loadFileAsDocumentSource`が典型例）で使う。
 * キャッシュする値の型は問わないため、`Promise`そのものをキャッシュして同時多発する
 * 呼び出しを1回の処理へ合流させる（呼び出し側が`set`直後に`await`前の`Promise`を渡す）用途にも使える。
 *
 * テスト容易性のため、現在時刻の取得元（`now`）を差し替え可能にしている
 * （既定は`Date.now`。テストでは固定値・可変値を返す関数を渡せる）
 */
export interface TtlCache<K, V> {
  /** 有効期限内であれば値を返す。存在しない・期限切れの場合はundefined（期限切れエントリは削除する） */
  get(key: K): V | undefined;
  /** 値を登録し、`ttlMs`ミリ秒後に期限切れとする */
  set(key: K, value: V, ttlMs: number): void;
  /** 指定キーのエントリを破棄する（存在しなくても何もしない） */
  delete(key: K): void;
  /** 条件に一致するキーのエントリをまとめて破棄する */
  deleteWhere(predicate: (key: K) => boolean): void;
}

interface Entry<V> {
  value: V;
  expiresAt: number;
}

/** `createTtlCache`のオプション。テストで現在時刻を固定・制御するために使う */
export interface TtlCacheOptions {
  /** 現在時刻（エポックミリ秒）を返す関数。既定は`Date.now` */
  now?: () => number;
}

/** 汎用TTLキャッシュを作る */
export function createTtlCache<K, V>(options: TtlCacheOptions = {}): TtlCache<K, V> {
  const now = options.now ?? Date.now;
  const store = new Map<K, Entry<V>>();

  return {
    get(key) {
      const entry = store.get(key);
      if (entry === undefined) return undefined;
      if (entry.expiresAt <= now()) {
        // 期限切れエントリは次回以降の無駄な参照を避けるためこの時点で削除する
        store.delete(key);
        return undefined;
      }
      return entry.value;
    },

    set(key, value, ttlMs) {
      store.set(key, { value, expiresAt: now() + ttlMs });
    },

    delete(key) {
      store.delete(key);
    },

    deleteWhere(predicate) {
      for (const key of store.keys()) {
        if (predicate(key)) store.delete(key);
      }
    },
  };
}
