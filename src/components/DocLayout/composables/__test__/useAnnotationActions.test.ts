import { describe, expect, it, beforeEach, mock } from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import { useHistoryStore } from 'src/stores/historyStore';
import type { AnnotationID } from 'src/models/document/pdf';
import type { AnnotationGroup, AnnotationGroupID } from 'src/models/document/group';
import type { AnnotationStyle } from 'src/models/document/pdf';
import type { ContainerElementFile, ContainerID } from 'src/models/container';
import {
  markAnnotationWriteIntent,
  getPendingAnnotationStyle,
  resolveAnnotationEcho,
} from 'src/utils/document/annotationWritePending';

/**
 * Issue #109の回帰テスト：グループ化・削除操作が、`.kcfg`／アノテーションDBへの実際の
 * 永続化（意図的に遅延させたモック）の完了を待たずに、UIのリアクティブ状態
 * （グループとして操作可能かどうか・選択状態）へ即座に反映されることを確認する。
 *
 * `useAnnotationActions.ts`は`useBackendApi`（PDF描画等ブラウザAPI依存を含む巨大なファサード）を
 * 静的importしているため、`useAnnotationHistory.test.ts`と同様に実際に呼ばれるメソッドだけを
 * モック化する。groupStore・historyStore・editorStore・relationalStoreは実体のPiniaストアを使う
 */
type MockApiResult<T = undefined> = { ok: true; data: T } | { ok: false; error: unknown };

/** 手動で解決タイミングを制御できるPromiseを組み立てる（永続化が遅いモックの代わりに使う） */
function createDeferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const apiMock = {
  groupAnnotations: mock(
    (): Promise<MockApiResult<{ group: AnnotationGroup; dissolvedGroups: AnnotationGroup[] }>> =>
      Promise.resolve({ ok: true, data: { group: dummyGroup(), dissolvedGroups: [] } }),
  ),
  ungroupAnnotations: mock((): Promise<MockApiResult> =>
    Promise.resolve({ ok: true, data: undefined }),
  ),
  updateGroupValueAggregation: mock((): Promise<MockApiResult<AnnotationGroup>> =>
    Promise.resolve({ ok: true, data: dummyGroup() }),
  ),
  removeAnnotation: mock((): Promise<MockApiResult> =>
    Promise.resolve({ ok: true, data: undefined }),
  ),
  removeAnnotations: mock((): Promise<MockApiResult> =>
    Promise.resolve({ ok: true, data: undefined }),
  ),
  removeGroupMembers: mock((): Promise<MockApiResult<AnnotationGroup>> =>
    Promise.resolve({ ok: true, data: dummyGroup() }),
  ),
  restoreGroup: mock((): Promise<MockApiResult<AnnotationGroup>> =>
    Promise.resolve({ ok: true, data: dummyGroup() }),
  ),
  registerAnnotationStyle: mock((): Promise<MockApiResult> =>
    Promise.resolve({ ok: true, data: undefined }),
  ),
  registerAnnotationStyles: mock((): Promise<MockApiResult> =>
    Promise.resolve({ ok: true, data: undefined }),
  ),
  reorderAnnotation: mock((): Promise<MockApiResult<{ style: AnnotationStyle }>> =>
    Promise.resolve({ ok: true, data: { style: buildStyle(idA) } }),
  ),
  pasteAnnotations: mock(
    (): Promise<MockApiResult<{ style: AnnotationStyle }[]>> =>
      Promise.resolve({ ok: true, data: [] }),
  ),
};
void mock.module('src/apis/backendApi', () => ({ useBackendApi: () => apiMock }));

const { useAnnotationActions } = await import('../useAnnotationActions');
const { useGroupStore } = await import('src/stores/groupStore');
const { useEditorStore } = await import('src/stores/editorStore');

const containerID = '00000000-0000-4000-8000-000000000000' as ContainerID;
const file: ContainerElementFile = {
  containerID,
  type: 'File' as const,
  path: 'doc.pdf',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  description: '',
  genre: '',
  tags: [],
};
const key = `${containerID}|doc.pdf`;

const idA = '00000000-0000-4000-8000-000000000001' as AnnotationID;
const idB = '00000000-0000-4000-8000-000000000002' as AnnotationID;
const idC = '00000000-0000-4000-8000-000000000003' as AnnotationID;
const groupId = '00000000-0000-4000-8000-0000000000aa' as AnnotationGroupID;

function dummyGroup(): AnnotationGroup {
  const now = '2026-01-01T00:00:00.000Z';
  return { id: groupId, memberIds: [idA, idB], createdAt: now, updatedAt: now };
}

/** テストで使う最小限のフィールドだけを埋めたAnnotationStyle（box種別）を組み立てる */
function buildStyle(id: AnnotationID): AnnotationStyle {
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
  };
}

beforeEach(() => {
  setActivePinia(createPinia());
  for (const fn of Object.values(apiMock)) fn.mockClear();
  // 各テスト間でモジュールスコープの共有Map（annotationWritePending.ts）が漏れないよう、
  // 既存の目印を消費しておく
  for (const id of [idA, idB, idC]) {
    const leftover = getPendingAnnotationStyle(id);
    if (leftover) resolveAnnotationEcho(leftover);
  }
});

describe('groupSelected（Issue #109: グループ化直後に即座にグループとして操作できること）', () => {
  it('.kcfgへの永続化（意図的に遅延させたモック）が解決する前に、groupStoreがグループとして認識する', async () => {
    const groupStore = useGroupStore();
    const annotations = ref([buildStyle(idA), buildStyle(idB)]);
    const selectedAnnotationIds = ref<AnnotationID[]>([idA, idB]);
    const actions = useAnnotationActions({
      file,
      annotations,
      selectedAnnotationIds,
      currentPage: ref(1),
    });

    // 永続化を意図的に遅延させる（手動で解決するまで完了しないPromise）
    const deferred =
      createDeferred<
        MockApiResult<{ group: AnnotationGroup; dissolvedGroups: AnnotationGroup[] }>
      >();
    apiMock.groupAnnotations.mockImplementationOnce(() => deferred.promise);

    const pending = actions.groupSelected();

    // 永続化Promiseがまだ解決していない時点で、既にグループとして操作可能になっていること
    expect(groupStore.matchingGroup(key, [idA, idB])).toBeDefined();
    expect(selectedAnnotationIds.value.sort()).toEqual([idA, idB].sort());

    // 永続化を解決し、最終的な整合性も保たれることを確認する
    deferred.resolve({ ok: true, data: { group: dummyGroup(), dissolvedGroups: [] } });
    await pending;
    expect(groupStore.matchingGroup(key, [idA, idB])?.id).toBe(groupId);
  });

  it('永続化が失敗した場合、仮のグループ反映・選択状態を取り消す', async () => {
    const groupStore = useGroupStore();
    const annotations = ref([buildStyle(idA), buildStyle(idB)]);
    const selectedAnnotationIds = ref<AnnotationID[]>([idA, idB]);
    const actions = useAnnotationActions({
      file,
      annotations,
      selectedAnnotationIds,
      currentPage: ref(1),
    });

    apiMock.groupAnnotations.mockImplementationOnce(() =>
      Promise.resolve({ ok: false, error: new Error('write failed') }),
    );

    await actions.groupSelected();

    expect(groupStore.matchingGroup(key, [idA, idB])).toBeUndefined();
    expect(groupStore.groupsByFileKey[key] ?? []).toEqual([]);
  });
});

describe('deleteSelected（Issue #109: Delete押下直後に選択状態が即座に解除されること）', () => {
  it('アノテーションDBへの削除（意図的に遅延させたモック）が解決する前に、選択が空になる', async () => {
    const annotations = ref([buildStyle(idA)]);
    const selectedAnnotationIds = ref<AnnotationID[]>([idA]);
    const actions = useAnnotationActions({
      file,
      annotations,
      selectedAnnotationIds,
      currentPage: ref(1),
    });

    const deferred = createDeferred<MockApiResult>();
    apiMock.removeAnnotations.mockImplementationOnce(() => deferred.promise);

    const pending = actions.deleteSelected();

    // 削除の永続化Promiseがまだ解決していない時点で、選択状態は既に空になっていること
    expect(selectedAnnotationIds.value).toEqual([]);

    deferred.resolve({ ok: true, data: undefined });
    await pending;
    expect(apiMock.removeAnnotations).toHaveBeenCalledWith(file, [idA]);
  });
});

describe('resolveSelected（レビュー指摘の是正確認: DB購読側にまだ反映されていない選択IDへの操作）', () => {
  it('選択IDがdeps.annotationsにまだ存在せず、ローカルの書き込み意図（pending）にのみ存在する場合でもサイレントに空振りしない', async () => {
    // AnnotationLayer.vueが新規描画確定時にselectedAnnotIdsを即座にセットするようになった
    // ため、DB購読（liveQuery）側の一覧`annotations`にまだ反映されていないタイミングで
    // Delete等のショートカット操作が行われうる（Box等ネットワーク越しのコンテナでは
    // 十分起こりうるタイミング）。修正前はresolveSelected()が生のdeps.annotationsからしか
    // 探さないため、この場合空配列を返し操作がサイレントに空振りしていた
    const pendingStyle = buildStyle(idC);
    markAnnotationWriteIntent(pendingStyle);

    const annotations = ref<AnnotationStyle[]>([]); // まだDB購読側に反映されていない
    const selectedAnnotationIds = ref<AnnotationID[]>([idC]);
    const actions = useAnnotationActions({
      file,
      annotations,
      selectedAnnotationIds,
      currentPage: ref(1),
    });

    await actions.deleteSelected();

    expect(apiMock.removeAnnotations).toHaveBeenCalledWith(file, [idC]);
  });
});

describe('reorderSelected（コーディネーターからの再指摘: DB購読側に未反映の選択IDでも重ね順変更のUndo履歴が記録されること）', () => {
  it('選択IDがdeps.annotationsにまだ存在せず、ローカルの書き込み意図（pending）にのみ存在する場合でもUndo履歴が記録される', async () => {
    const historyStore = useHistoryStore();
    // 新規描画直後、まだDB購読（liveQuery）側の一覧annotationsに反映されていない状態を模す
    const pendingStyle = buildStyle(idC);
    markAnnotationWriteIntent(pendingStyle);

    const annotations = ref<AnnotationStyle[]>([]);
    const selectedAnnotationIds = ref<AnnotationID[]>([idC]);
    const actions = useAnnotationActions({
      file,
      annotations,
      selectedAnnotationIds,
      currentPage: ref(1),
    });

    apiMock.reorderAnnotation.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        data: { style: { ...pendingStyle, zIndex: 1, updatedAt: '2026-01-01T00:00:02.000Z' } },
      }),
    );

    expect(historyStore.canUndo(file)).toBe(false);
    await actions.reorderSelected('front');

    // 修正前はbeforeById（生のdeps.annotationsのみから構築）がidCの「変更前」を見つけられず、
    // pairsが空のままhistory.recordChangedBatchがreturnしてしまい、api.reorderAnnotation自体は
    // 成立するのにUndo履歴に記録されなかった
    expect(apiMock.reorderAnnotation).toHaveBeenCalledWith(file, idC, 'front');
    expect(historyStore.canUndo(file)).toBe(true);
  });
});

describe('nudgeSelected（矢印キーによる微調整）', () => {
  it('選択中の全注釈をまとめてx/yだけ移動し、1つのUndoステップとして記録する', async () => {
    const historyStore = useHistoryStore();
    const annotations = ref([buildStyle(idA), buildStyle(idB)]);
    const selectedAnnotationIds = ref<AnnotationID[]>([idA, idB]);
    const actions = useAnnotationActions({
      file,
      annotations,
      selectedAnnotationIds,
      currentPage: ref(1),
    });

    await actions.nudgeSelected(5, -3);

    expect(apiMock.registerAnnotationStyles).toHaveBeenCalledTimes(1);
    const [, styles] = apiMock.registerAnnotationStyles.mock.calls[0] as unknown as [
      ContainerElementFile,
      AnnotationStyle[],
    ];
    expect(styles.map((s) => ({ x: s.x, y: s.y }))).toEqual([
      { x: 5, y: -3 },
      { x: 5, y: -3 },
    ]);
    expect(historyStore.canUndo(file)).toBe(true);
  });

  it('選択が無い場合は何もしない', async () => {
    const actions = useAnnotationActions({
      file,
      annotations: ref([]),
      selectedAnnotationIds: ref<AnnotationID[]>([]),
      currentPage: ref(1),
    });

    await actions.nudgeSelected(1, 1);

    expect(apiMock.registerAnnotationStyles).not.toHaveBeenCalled();
  });
});

describe('copySelected（アプリ内クリップボードへのコピー）', () => {
  it('選択が既存グループ全体と一致する場合、値算出方法も一緒にクリップボードへ記録する', () => {
    const editorStore = useEditorStore();
    const groupStore = useGroupStore();
    groupStore.groupsByFileKey[key] = [{ ...dummyGroup(), valueAggregation: { type: 'sum' } }];

    const actions = useAnnotationActions({
      file,
      annotations: ref([buildStyle(idA), buildStyle(idB)]),
      selectedAnnotationIds: ref<AnnotationID[]>([idA, idB]),
      currentPage: ref(1),
    });

    actions.copySelected();

    expect(editorStore.annotationClipboard?.map((a) => a.id)).toEqual([idA, idB]);
    expect(editorStore.annotationClipboardGroupInfo).toEqual({
      valueAggregation: { type: 'sum' },
    });
  });

  it('選択が無い場合は何もしない', () => {
    const editorStore = useEditorStore();
    const actions = useAnnotationActions({
      file,
      annotations: ref([]),
      selectedAnnotationIds: ref<AnnotationID[]>([]),
      currentPage: ref(1),
    });

    actions.copySelected();

    expect(editorStore.annotationClipboard).toBeNull();
  });
});

describe('pasteClipboard（クリップボードの貼り付け）', () => {
  it('選択中の注釈がある場合、その位置から少しずらした位置へ貼り付け、貼り付け結果を選択状態にする', async () => {
    const editorStore = useEditorStore();
    const historyStore = useHistoryStore();
    editorStore.setAnnotationClipboard([buildStyle(idA)]);

    const pasted = { ...buildStyle(idC), x: 999, y: 999 };
    apiMock.pasteAnnotations.mockImplementationOnce(() =>
      Promise.resolve({ ok: true, data: [{ style: pasted }] }),
    );

    const actions = useAnnotationActions({
      file,
      annotations: ref([buildStyle(idB)]),
      selectedAnnotationIds: ref<AnnotationID[]>([idB]),
      currentPage: ref(2),
    });

    await actions.pasteClipboard();

    expect(apiMock.pasteAnnotations).toHaveBeenCalledWith(file, [buildStyle(idA)], 2, {
      dx: 20,
      dy: 20,
    });
    expect(historyStore.canUndo(file)).toBe(true);
  });

  it('選択が無くカーソル位置も未取得の場合、コピー元から少しずらした位置へ貼り付ける', async () => {
    const editorStore = useEditorStore();
    editorStore.setAnnotationClipboard([buildStyle(idA)]);
    apiMock.pasteAnnotations.mockImplementationOnce(() =>
      Promise.resolve({ ok: true, data: [{ style: buildStyle(idC) }] }),
    );

    const actions = useAnnotationActions({
      file,
      annotations: ref([]),
      selectedAnnotationIds: ref<AnnotationID[]>([]),
      currentPage: ref(1),
    });

    await actions.pasteClipboard();

    expect(apiMock.pasteAnnotations).toHaveBeenCalledWith(file, [buildStyle(idA)], 1, {
      dx: 20,
      dy: 20,
    });
  });

  it('クリップボードが空の場合は何もしない', async () => {
    const actions = useAnnotationActions({
      file,
      annotations: ref([]),
      selectedAnnotationIds: ref<AnnotationID[]>([]),
      currentPage: ref(1),
    });

    await actions.pasteClipboard();

    expect(apiMock.pasteAnnotations).not.toHaveBeenCalled();
  });

  it('コピー元が丸ごと1つのグループだった場合、貼り付け後に同じ値算出方法で新しいグループを作り直す', async () => {
    const editorStore = useEditorStore();
    editorStore.setAnnotationClipboard([buildStyle(idA), buildStyle(idB)], {
      valueAggregation: { type: 'sum' },
    });
    const createdA = buildStyle(idA);
    const createdB = buildStyle(idB);
    apiMock.pasteAnnotations.mockImplementationOnce(() =>
      Promise.resolve({ ok: true, data: [{ style: createdA }, { style: createdB }] }),
    );

    const actions = useAnnotationActions({
      file,
      annotations: ref([]),
      selectedAnnotationIds: ref<AnnotationID[]>([]),
      currentPage: ref(1),
    });

    await actions.pasteClipboard();

    expect(apiMock.groupAnnotations).toHaveBeenCalledWith(file, [idA, idB]);
    expect(apiMock.updateGroupValueAggregation).toHaveBeenCalledWith(file, groupId, {
      type: 'sum',
    });
  });
});

describe('duplicateSelected（選択中注釈のその場複製）', () => {
  it('選択中の注釈をPASTE_OFFSET_STEP分ずらした位置に複製し、複製結果を選択状態にする', async () => {
    const historyStore = useHistoryStore();
    const duplicated = buildStyle(idC);
    apiMock.pasteAnnotations.mockImplementationOnce(() =>
      Promise.resolve({ ok: true, data: [{ style: duplicated }] }),
    );

    const selectedAnnotationIds = ref<AnnotationID[]>([idA]);
    const actions = useAnnotationActions({
      file,
      annotations: ref([buildStyle(idA)]),
      selectedAnnotationIds,
      currentPage: ref(3),
    });

    await actions.duplicateSelected();

    expect(apiMock.pasteAnnotations).toHaveBeenCalledWith(file, [buildStyle(idA)], 3, {
      dx: 20,
      dy: 20,
    });
    expect(selectedAnnotationIds.value).toEqual([idC]);
    expect(historyStore.canUndo(file)).toBe(true);
  });

  it('永続化に失敗した場合は選択状態を変えない', async () => {
    apiMock.pasteAnnotations.mockImplementationOnce(() =>
      Promise.resolve({ ok: false, error: new Error('write failed') }),
    );

    const selectedAnnotationIds = ref<AnnotationID[]>([idA]);
    const actions = useAnnotationActions({
      file,
      annotations: ref([buildStyle(idA)]),
      selectedAnnotationIds,
      currentPage: ref(1),
    });

    await actions.duplicateSelected();

    expect(selectedAnnotationIds.value).toEqual([idA]);
  });

  it('選択が無い場合は何もしない', async () => {
    const actions = useAnnotationActions({
      file,
      annotations: ref([]),
      selectedAnnotationIds: ref<AnnotationID[]>([]),
      currentPage: ref(1),
    });

    await actions.duplicateSelected();

    expect(apiMock.pasteAnnotations).not.toHaveBeenCalled();
  });
});

describe('ungroupSelected（グループ化の解除）', () => {
  it('選択が既存グループの全メンバーと一致する場合、即座にグループを解除しUndo履歴に記録する', async () => {
    const groupStore = useGroupStore();
    const historyStore = useHistoryStore();
    groupStore.groupsByFileKey[key] = [dummyGroup()];

    const actions = useAnnotationActions({
      file,
      annotations: ref([buildStyle(idA), buildStyle(idB)]),
      selectedAnnotationIds: ref<AnnotationID[]>([idA, idB]),
      currentPage: ref(1),
    });

    await actions.ungroupSelected();

    expect(groupStore.matchingGroup(key, [idA, idB])).toBeUndefined();
    expect(apiMock.ungroupAnnotations).toHaveBeenCalledWith(file, groupId);
    expect(historyStore.canUndo(file)).toBe(true);
  });

  it('永続化に失敗した場合は解除前のグループを復元する', async () => {
    const groupStore = useGroupStore();
    groupStore.groupsByFileKey[key] = [dummyGroup()];
    apiMock.ungroupAnnotations.mockImplementationOnce(() =>
      Promise.resolve({ ok: false, error: new Error('write failed') }),
    );

    const actions = useAnnotationActions({
      file,
      annotations: ref([buildStyle(idA), buildStyle(idB)]),
      selectedAnnotationIds: ref<AnnotationID[]>([idA, idB]),
      currentPage: ref(1),
    });

    await actions.ungroupSelected();

    expect(groupStore.matchingGroup(key, [idA, idB])?.id).toBe(groupId);
  });

  it('選択が既存グループと一致しない場合は何もしない', async () => {
    const actions = useAnnotationActions({
      file,
      annotations: ref([buildStyle(idA)]),
      selectedAnnotationIds: ref<AnnotationID[]>([idA]),
      currentPage: ref(1),
    });

    await actions.ungroupSelected();

    expect(apiMock.ungroupAnnotations).not.toHaveBeenCalled();
  });
});
