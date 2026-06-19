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
export function Success<T>(value: T): Success<T> {
  return { ok: true, value };
}

export function Failure<E = Error>(error: E): Failure<E> {
  return { ok: false, error };
}

// 型ガード
export function isSuccess<T, E = Error>(r: Result<T, E>): r is Success<T> {
  return (r as Success<T>).ok === true;
}

export function isFailure<T, E = Error>(r: Result<T, E>): r is Failure<E> {
  return (r as Failure<E>).ok === false;
}

// ユーティリティ関数
export function map<T, U, E = Error>(r: Result<T, E>, fn: (v: T) => U): Result<U, E> {
  return isSuccess(r) ? Success(fn(r.value)) : (r as Failure<E>);
}

export function mapError<T, E, F = Error>(r: Result<T, E>, fn: (e: E) => F): Result<T, F> {
  return isFailure(r) ? Failure(fn(r.error)) : (r as Success<T>);
}

export function unwrapOr<T, E = Error>(r: Result<T, E>, fallback: T): T {
  return isSuccess(r) ? r.value : fallback;
}

export function unwrapOrThrow<T, E = Error>(r: Result<T, E>): T {
  if (isSuccess(r)) return r.value;
  const e = (r as Failure<E>).error;
  if (e instanceof Error) throw e as unknown as Error;
  throw new Error(String(e));
}

export function match<T, E, R>(
  r: Result<T, E>,
  onSuccess: (v: T) => R,
  onFailure: (e: E) => R
): R {
  return isSuccess(r) ? onSuccess(r.value) : onFailure((r as Failure<E>).error);
}

// 例:
// const res: Result<number> = Success(42);
// if (isSuccess(res)) console.log(res.value);
// const doubled = map(res, x => x * 2);
