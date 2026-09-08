import { describe, expect, it, beforeEach, mock } from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';
import { nextTick, reactive } from 'vue';
import type { AnnotationID, BoxAnnotationStyle } from 'src/models/document/pdf';
import { DEFAULT_RELATIONAL_VERIFICATION_STYLE } from 'src/models/relational/style';
import {
  markAnnotationWriteIntent,
  resolveAnnotationEcho,
  getPendingAnnotationStyle,
  reconcilePendingWrites,
} from 'src/utils/document/annotationWritePending';

/**
 * Issue #109の回帰テスト：`useAnnotationShape`の`displayAnnotation`が、DB書き込み・DB購読
 * （liveQuery）の反映という実際の永続化を一切待たずに、ローカルで意図した最新の内容
 * （スタイルパネルでの色変更・新規描画直後のドラッグ確定等）を即座に反映することを確認する
 * （症状4「スタイル変更の反映が遅い」・症状1「描画直後の移動・変形」の土台となる仕組み）
 *
 * `useAnnotationShape.ts`は`useSettingsStore`（`src/boot/i18n`経由でQuasarのboot定義を
 * 静的importする）を経由するため、Bunのテスト環境で実体のまま読み込むと失敗する。
 * `useAnnotationHistory.test.ts`が`useBackendApi`をモック化するのと同じ理由で、
 * ここでは`useSettingsStore`自体を最小限のモックに差し替える
 */
void mock.module('src/stores/settingsStore', () => ({
  useSettingsStore: () => ({ relationalVerificationStyle: DEFAULT_RELATIONAL_VERIFICATION_STYLE }),
}));
void mock.module('src/apis/backendApi', () => ({ useBackendApi: () => ({}) }));

const { useAnnotationShape } = await import('../useAnnotationShape');

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
  setActivePinia(createPinia());
  const leftover = getPendingAnnotationStyle(idA);
  if (leftover) resolveAnnotationEcho(leftover);
});

describe('displayAnnotation（症状4: スタイル変更反映の遅延対策）', () => {
  it('スタイルパネルでの変更（永続化のPromiseは未解決）を、DB購読の反映を待たず即座に表示する', async () => {
    const initial = buildStyle({ color: '#000000' as never });
    const props = reactive({ annotation: initial });
    const shape = useAnnotationShape(props);

    expect(shape.displayAnnotation.value.color).toBe('#000000' as never);

    // スタイルパネルでの色変更を模す：registerStyleTracked相当（永続化のawait前）の
    // markAnnotationWriteIntentだけを呼び、DB確定・DB購読側の反映（props.annotationの更新）は
    // まだ一切起きていない状態にする
    const edited = { ...initial, color: '#ff0000' as never, updatedAt: '2026-01-01T00:00:01.000Z' };
    markAnnotationWriteIntent(edited);
    await nextTick();

    expect(shape.displayAnnotation.value.color).toBe('#ff0000' as never);
    // props.annotation自体（DB購読由来）はまだ古いまま = 永続化のPromiseはまだ解決していない
    expect(props.annotation.color).toBe('#000000' as never);
  });

  it('DB購読側の反映（確定エコー）が届いた後は、通常通りprops.annotationへ追従する', async () => {
    const initial = buildStyle({ color: '#000000' as never });
    const props = reactive({ annotation: initial });
    const shape = useAnnotationShape(props);

    const edited = { ...initial, color: '#ff0000' as never, updatedAt: '2026-01-01T00:00:01.000Z' };
    markAnnotationWriteIntent(edited);
    await nextTick();
    expect(shape.displayAnnotation.value.color).toBe('#ff0000' as never);

    // DB購読（liveQuery）側がようやく追いついた（＝確定エコーが届いた）状態を模す
    props.annotation = edited;
    await nextTick();

    expect(shape.displayAnnotation.value).toEqual(edited);
    expect(getPendingAnnotationStyle(idA)).toBeUndefined();
  });
});

describe('ページ仮想化によるアンマウント後もpendingが孤立しないこと（Issue #109是正: ゴースト表示バグの回帰確認）', () => {
  it('シェイプが一度もマウントされずresolveAnnotationEchoを誰も呼ばなくても、reconcilePendingWrites経由で解決されていれば後続の確定値が正しく反映される', async () => {
    const created = buildStyle({ updatedAt: '2026-01-01T00:00:01.000Z' });
    // 新規描画直後、DB登録のPromiseがまだ解決していない状態を模す
    markAnnotationWriteIntent(created);

    // この時点ではuseAnnotationShapeのインスタンスを一切生成しない
    // （＝ページ仮想化によりKonvaシェイプが直後にアンマウントされ、個別watchが
    // resolveAnnotationEchoを一度も呼べなかった状況を模す）。修正前はこの状態のまま
    // pendingWritesのエントリが永久に孤立し、以降どんな確定値が届いても
    // getPendingAnnotationStyleが古い内容を返し続けてしまっていた。
    // ファイル単位のDB購読コールバック（DocumentTabView.vue）が確定済み一覧全体を渡して
    // 解決を試みることで、シェイプのマウント状態に依存せず解決できるようにする
    reconcilePendingWrites([created]);
    expect(getPendingAnnotationStyle(idA)).toBeUndefined();

    // 後から（OCR再処理・別タブでの編集等の正当な外部変更で）別のupdatedAtを持つ確定値が
    // 届いた状態で、該当ページが再びビューポート内に入りシェイプが新規マウントされたとする
    const externalUpdate = {
      ...created,
      color: '#00ff00' as never,
      updatedAt: '2026-01-01T00:00:05.000Z',
    };
    const props = reactive({ annotation: externalUpdate });
    const shape = useAnnotationShape(props);
    await nextTick();

    // 孤立したpendingに凍結され続けず、新しい確定値が正しく反映されること
    expect(shape.displayAnnotation.value).toEqual(externalUpdate);
  });
});

describe('commitBodyDrag（症状1: 描画直後でも永続化を待たずに移動を確定できること）', () => {
  it('新規作成直後・永続化未解決の状態でも、ドラッグ移動の確定が即座にdisplayAnnotationへ反映される', () => {
    const created = buildStyle({ updatedAt: '2026-01-01T00:00:01.000Z' });
    // 描画確定直後、DB登録のPromiseがまだ解決していない状態を模す
    markAnnotationWriteIntent(created);
    const props = reactive({ annotation: created });
    const shape = useAnnotationShape(props);

    shape.beginBodyDrag({
      getAbsolutePosition: () => ({ x: 0, y: 0 }),
    } as unknown as Parameters<typeof shape.beginBodyDrag>[0]);
    const moved = shape.commitBodyDrag({} as Parameters<typeof shape.commitBodyDrag>[0], {
      x: 20,
      y: 30,
    });

    expect(moved.x).toBe(20);
    expect(moved.y).toBe(30);
    expect(shape.displayAnnotation.value.x).toBe(20);
    expect(shape.displayAnnotation.value.y).toBe(30);
  });
});
