// Result 型: 成功と失敗を表現する汎用ユニオン型

export interface Success<T> {
  ok: true;
  value: T;
}

export interface Failure<E = Error> {
  ok: false;
  error: E;
}

export type Result<T, E = Error> = Success<T> | Failure<E>;

// コンストラクタ関数
export function Success<T = void>(value?: T): Success<T> {
  return { ok: true, value: value as T };
}

export function Failure<E = Error>(error: E): Failure<E> {
  return { ok: false, error };
}

export function unwrapOr<T, E = Error>(r: Result<T, E>, fallback: T): T {
  return r.ok ? r.value : fallback;
}

export function unwrapOrThrow<T, E = Error>(r: Result<T, E>): T {
  if (r.ok) return r.value;
  const e = r.error;
  if (e instanceof Error) throw e as unknown as Error;
  throw new Error(String(e));
}
