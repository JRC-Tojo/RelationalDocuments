import { describe, expect, it } from 'bun:test';
import {
  markAnnotationWriteIntent,
  cancelAnnotationWriteIntent,
  resolveAnnotationEcho,
} from '../annotationWritePending';
import type { AnnotationID, AnnotationStyle } from 'src/models/document/pdf';

const idA = '00000000-0000-4000-8000-000000000001' as AnnotationID;
const idB = '00000000-0000-4000-8000-000000000002' as AnnotationID;

function buildStyle(id: AnnotationID, updatedAt: string): AnnotationStyle {
  return { id, updatedAt } as unknown as AnnotationStyle;
}

describe('resolveAnnotationEcho', () => {
  it('目印が無いIDへの更新はそのまま反映してよい（外部由来の変更）', () => {
    expect(resolveAnnotationEcho(buildStyle(idA, '2026-01-01T00:00:00.000Z'))).toBeTrue();
  });

  it('意図した書き込みの内容とちょうど一致する更新は反映してよい', () => {
    markAnnotationWriteIntent(idA, '2026-01-01T00:00:00.000Z');

    expect(resolveAnnotationEcho(buildStyle(idA, '2026-01-01T00:00:00.000Z'))).toBeTrue();
  });

  it('一致した更新を消費した後は、目印が無くなり以後の更新は素通しになる', () => {
    markAnnotationWriteIntent(idA, '2026-01-01T00:00:00.000Z');
    resolveAnnotationEcho(buildStyle(idA, '2026-01-01T00:00:00.000Z'));

    expect(resolveAnnotationEcho(buildStyle(idA, '2020-01-01T00:00:00.000Z'))).toBeTrue();
  });

  it('意図した内容とまだ一致しない更新（追いついていない古いエコー）は無視する', () => {
    markAnnotationWriteIntent(idA, '2026-01-02T00:00:00.000Z');

    expect(resolveAnnotationEcho(buildStyle(idA, '2026-01-01T00:00:00.000Z'))).toBeFalse();
  });

  it('他のIDの目印には影響しない', () => {
    markAnnotationWriteIntent(idA, '2026-01-01T00:00:00.000Z');

    expect(resolveAnnotationEcho(buildStyle(idB, '2020-01-01T00:00:00.000Z'))).toBeTrue();
  });
});

describe('cancelAnnotationWriteIntent', () => {
  it('取り消し対象が依然として最後に意図した内容であれば目印を消し、以後の更新が素通しになる', () => {
    markAnnotationWriteIntent(idA, '2026-01-01T00:00:00.000Z');

    cancelAnnotationWriteIntent(idA, '2026-01-01T00:00:00.000Z');

    expect(resolveAnnotationEcho(buildStyle(idA, '2020-01-01T00:00:00.000Z'))).toBeTrue();
  });

  it('既により新しい書き込みが発行済みの場合は何もしない（自分の目印ではないため）', () => {
    markAnnotationWriteIntent(idA, '2026-01-01T00:00:00.000Z');
    markAnnotationWriteIntent(idA, '2026-01-02T00:00:00.000Z');

    cancelAnnotationWriteIntent(idA, '2026-01-01T00:00:00.000Z');

    // 新しい目印(2026-01-02)がまだ有効なため、それ以外の更新は無視され続ける
    expect(resolveAnnotationEcho(buildStyle(idA, '2020-01-01T00:00:00.000Z'))).toBeFalse();
    expect(resolveAnnotationEcho(buildStyle(idA, '2026-01-02T00:00:00.000Z'))).toBeTrue();
  });
});
