/**
 * ttlCache.ts の単体テスト
 *
 * `services/container/main.ts`の`loadFileAsDocumentSource`短期キャッシュ（大きな文書を開く際、
 * 同一ファイルへの連続アクセスで実ストレージへの重複読み込みを避けるためのもの）が内部で
 * 使う汎用ユーティリティ。モジュールモックを一切必要としない純粋なロジックのため、
 * 現在時刻を差し替え可能な`now`オプションを使い、決定的にTTL挙動を検証できる
 */
import { describe, expect, it } from 'bun:test';
import { createTtlCache } from '../ttlCache';

describe('createTtlCache', () => {
  it('setした値をTTL内であればgetで取得できる', () => {
    let current = 0;
    const cache = createTtlCache<string, number>({ now: () => current });

    cache.set('a', 123, 1000);
    current = 999;
    expect(cache.get('a')).toBe(123);
  });

  it('TTLちょうどで期限切れとして扱う（境界値）', () => {
    let current = 0;
    const cache = createTtlCache<string, number>({ now: () => current });

    cache.set('a', 123, 1000);
    current = 1000; // expiresAt(=1000)と同時刻はもう有効期限切れ
    expect(cache.get('a')).toBeUndefined();
  });

  it('TTL経過後はundefinedを返し、エントリ自体も破棄する', () => {
    let current = 0;
    const cache = createTtlCache<string, number>({ now: () => current });

    cache.set('a', 123, 1000);
    current = 1001;
    expect(cache.get('a')).toBeUndefined();

    // 破棄済みのため、TTLの起点をリセットして再度過去の時刻に戻しても復活しない
    current = 500;
    expect(cache.get('a')).toBeUndefined();
  });

  it('存在しないキーはundefinedを返す', () => {
    const cache = createTtlCache<string, number>();
    expect(cache.get('missing')).toBeUndefined();
  });

  it('deleteで明示的に破棄したエントリはTTL内でも返らない', () => {
    const cache = createTtlCache<string, number>();

    cache.set('a', 123, 10_000);
    cache.delete('a');
    expect(cache.get('a')).toBeUndefined();
  });

  it('deleteWhereで条件に一致するキーだけをまとめて破棄する', () => {
    const cache = createTtlCache<string, number>();
    cache.set('container1::a.pdf', 1, 10_000);
    cache.set('container1::b.pdf', 2, 10_000);
    cache.set('container2::a.pdf', 3, 10_000);

    cache.deleteWhere((key) => key.startsWith('container1::'));

    expect(cache.get('container1::a.pdf')).toBeUndefined();
    expect(cache.get('container1::b.pdf')).toBeUndefined();
    expect(cache.get('container2::a.pdf')).toBe(3);
  });

  it('同じキーへの再setは値とTTLを上書きする', () => {
    let current = 0;
    const cache = createTtlCache<string, string>({ now: () => current });

    cache.set('a', 'first', 100);
    current = 50;
    cache.set('a', 'second', 100); // 期限をcurrent(50)から再計算して150に延長
    current = 120;
    expect(cache.get('a')).toBe('second');
  });

  it('Promiseそのものをキャッシュし、同一Promiseを返せる（同時アクセスの合流用途）', async () => {
    const cache = createTtlCache<string, Promise<number>>();
    const promise = Promise.resolve(42);
    cache.set('a', promise, 10_000);

    expect(cache.get('a')).toBe(promise);
    expect(await cache.get('a')).toBe(42);
  });
});
