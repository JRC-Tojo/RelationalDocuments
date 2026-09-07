import { describe, expect, it, beforeEach } from 'bun:test';
import type { AnnotationID, BoxAnnotationStyle } from 'src/models/document/pdf';
import {
  markAnnotationWriteIntent,
  cancelAnnotationWriteIntent,
  resolveAnnotationEcho,
  getPendingAnnotationStyle,
} from '../annotationWritePending';

/**
 * Issue #109の回帰テスト：`markAnnotationWriteIntent`が、実際の永続化（DB書き込み・DB購読の反映）を
 * 一切待たずに、その場で意図した内容を`getPendingAnnotationStyle`から即座に参照できることを確認する。
 * この仕組みがUI側の即時反映（描画直後の操作可能化、スタイル変更の即時反映等）の土台になる
 */

const idA = '00000000-0000-4000-8000-000000000001' as AnnotationID;

function buildStyle(patch: Partial<BoxAnnotationStyle> = {}): BoxAnnotationStyle {
  return {
    id: idA,
    type: 'box',
    pageNumber: 1,
    x: 0,
    y: 0,
    color: '#000000' as never,
    strokeWidth: 2,
    strokeType: 'solid',
    width: 10,
    height: 10,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    comment: {},
    ...patch,
  };
}

beforeEach(() => {
  // 各テスト間でモジュールスコープの共有Mapが漏れないよう、既存の目印を消費しておく
  const leftover = getPendingAnnotationStyle(idA);
  if (leftover) resolveAnnotationEcho(leftover);
});

describe('markAnnotationWriteIntent / getPendingAnnotationStyle', () => {
  it('マークした直後、DB確定を一切待たずに意図した内容を即座に参照できる', () => {
    const style = buildStyle({ color: '#ff0000' as never, updatedAt: '2026-01-01T00:00:01.000Z' });

    expect(getPendingAnnotationStyle(idA)).toBeUndefined();
    markAnnotationWriteIntent(style);
    // ここではまだ何もawaitしていない（永続化のPromiseは一切絡んでいない）
    expect(getPendingAnnotationStyle(idA)).toEqual(style);
  });

  it('後から発行したより新しい意図で上書きされる', () => {
    const first = buildStyle({ updatedAt: '2026-01-01T00:00:01.000Z' });
    const second = buildStyle({ color: '#00ff00' as never, updatedAt: '2026-01-01T00:00:02.000Z' });

    markAnnotationWriteIntent(first);
    markAnnotationWriteIntent(second);

    expect(getPendingAnnotationStyle(idA)).toEqual(second);
  });
});

describe('cancelAnnotationWriteIntent', () => {
  it('書き込み失敗時、対応する目印を取り消す', () => {
    const style = buildStyle({ updatedAt: '2026-01-01T00:00:01.000Z' });
    markAnnotationWriteIntent(style);

    cancelAnnotationWriteIntent(idA, style.updatedAt);

    expect(getPendingAnnotationStyle(idA)).toBeUndefined();
  });

  it('取り消し対象のupdatedAtが、既に発行済みのより新しい意図と一致しない場合は何もしない', () => {
    const first = buildStyle({ updatedAt: '2026-01-01T00:00:01.000Z' });
    const second = buildStyle({ updatedAt: '2026-01-01T00:00:02.000Z' });
    markAnnotationWriteIntent(first);
    markAnnotationWriteIntent(second);

    // firstの書き込みが失敗したとして取り消しを試みるが、既にsecondへ上書きされているため無視される
    cancelAnnotationWriteIntent(idA, first.updatedAt);

    expect(getPendingAnnotationStyle(idA)).toEqual(second);
  });
});

describe('resolveAnnotationEcho', () => {
  it('目印が無いIDへの更新はそのまま反映してよい（true）', () => {
    expect(resolveAnnotationEcho(buildStyle())).toBe(true);
  });

  it('自分が意図した内容とちょうど一致するエコーが届くまでは反映を拒否する（false）', () => {
    const intended = buildStyle({ updatedAt: '2026-01-01T00:00:01.000Z' });
    markAnnotationWriteIntent(intended);

    // まだ古い内容のエコー（DB購読側が追いついていない）は拒否する
    const stale = buildStyle({ updatedAt: '2026-01-01T00:00:00.000Z' });
    expect(resolveAnnotationEcho(stale)).toBe(false);
    // 拒否している間は目印も内容も保持され続ける
    expect(getPendingAnnotationStyle(idA)).toEqual(intended);
  });

  it('一致するエコーが届いた時点で反映を許可し、目印を消費する', () => {
    const intended = buildStyle({ updatedAt: '2026-01-01T00:00:01.000Z' });
    markAnnotationWriteIntent(intended);

    expect(resolveAnnotationEcho(intended)).toBe(true);
    // 消費後は目印が無くなり、以降の更新は素通しになる
    expect(getPendingAnnotationStyle(idA)).toBeUndefined();
  });
});
