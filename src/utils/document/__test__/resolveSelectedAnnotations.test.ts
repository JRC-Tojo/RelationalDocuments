import { describe, expect, it, beforeEach } from 'bun:test';
import type { AnnotationID, BoxAnnotationStyle } from 'src/models/document/pdf';
import {
  markAnnotationWriteIntent,
  resolveAnnotationEcho,
  getPendingAnnotationStyle,
} from '../annotationWritePending';
import {
  resolveSelectedAnnotations,
  isSelectableAnnotationId,
} from '../resolveSelectedAnnotations';

/**
 * Issue #109の回帰テスト：新規描画直後、まだDB購読（liveQuery）側の一覧に現れていない
 * アノテーションでも、`resolveSelectedAnnotations`が選択の実体として即座に解決できることを確認する
 * （関係性ボタンの表示可否等、「選択中アノテーションの実体」に依存する判定が、DB確定を待たず
 * 動作するようになる根拠）。また、既存アノテーションのスタイル編集中も、DB購読側の古い内容ではなく
 * ローカルで意図した最新の内容が優先されることを確認する
 */

const idA = '00000000-0000-4000-8000-000000000001' as AnnotationID;
const idB = '00000000-0000-4000-8000-000000000002' as AnnotationID;

function buildStyle(id: AnnotationID, patch: Partial<BoxAnnotationStyle> = {}): BoxAnnotationStyle {
  return {
    id,
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
  for (const id of [idA, idB]) {
    const leftover = getPendingAnnotationStyle(id);
    if (leftover) resolveAnnotationEcho(leftover);
  }
});

describe('resolveSelectedAnnotations', () => {
  it('DB購読側の確定済み一覧にまだ現れていない新規作成分も、意図した内容で即座に解決する', () => {
    const created = buildStyle(idA, { updatedAt: '2026-01-01T00:00:01.000Z' });
    markAnnotationWriteIntent(created);

    // confirmed（DB購読由来の一覧）はまだ空 = 永続化・DB購読の反映を一切待っていない状態
    const resolved = resolveSelectedAnnotations([idA], []);

    expect(resolved).toEqual([created]);
  });

  it('スタイル編集中は、DB購読側の古い確定済み内容よりローカルで意図した最新の内容を優先する', () => {
    const confirmedOld = buildStyle(idA, { color: '#000000' as never });
    const editedLocally = buildStyle(idA, {
      color: '#ff0000' as never,
      updatedAt: '2026-01-01T00:00:01.000Z',
    });
    markAnnotationWriteIntent(editedLocally);

    const resolved = resolveSelectedAnnotations([idA], [confirmedOld]);

    expect(resolved).toEqual([editedLocally]);
  });

  it('ローカルの意図が無いIDはDB購読側の確定済み一覧から解決する', () => {
    const confirmed = buildStyle(idB);
    expect(resolveSelectedAnnotations([idB], [confirmed])).toEqual([confirmed]);
  });

  it('どちらにも存在しないIDは結果から除外する', () => {
    expect(resolveSelectedAnnotations([idA], [])).toEqual([]);
  });
});

describe('isSelectableAnnotationId', () => {
  it('DB購読側にまだ現れていなくても、ローカルの書き込み意図があれば選択可能とみなす', () => {
    markAnnotationWriteIntent(buildStyle(idA, { updatedAt: '2026-01-01T00:00:01.000Z' }));
    expect(isSelectableAnnotationId(idA, [])).toBe(true);
  });

  it('DB購読側にもローカルの意図にも無ければ選択不可とみなす（削除済み等）', () => {
    expect(isSelectableAnnotationId(idA, [])).toBe(false);
  });
});
