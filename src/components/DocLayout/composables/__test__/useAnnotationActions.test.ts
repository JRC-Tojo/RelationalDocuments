import { describe, expect, it, beforeEach, mock } from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';
import { ref } from 'vue';
import type { AnnotationID } from 'src/models/document/pdf';
import type { AnnotationGroup, AnnotationGroupID } from 'src/models/document/group';
import type { AnnotationStyle } from 'src/models/document/pdf';
import type { ContainerElementFile, ContainerID } from 'src/models/container';

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
  ungroupAnnotations: mock((): Promise<MockApiResult> => Promise.resolve({ ok: true, data: undefined })),
  updateGroupValueAggregation: mock(
    (): Promise<MockApiResult<AnnotationGroup>> =>
      Promise.resolve({ ok: true, data: dummyGroup() }),
  ),
  removeAnnotation: mock((): Promise<MockApiResult> => Promise.resolve({ ok: true, data: undefined })),
  removeAnnotations: mock(
    (): Promise<MockApiResult> => Promise.resolve({ ok: true, data: undefined }),
  ),
  removeGroupMembers: mock(
    (): Promise<MockApiResult<AnnotationGroup>> =>
      Promise.resolve({ ok: true, data: dummyGroup() }),
  ),
  restoreGroup: mock(
    (): Promise<MockApiResult<AnnotationGroup>> =>
      Promise.resolve({ ok: true, data: dummyGroup() }),
  ),
  registerAnnotationStyle: mock((): Promise<MockApiResult> => Promise.resolve({ ok: true, data: undefined })),
  registerAnnotationStyles: mock(
    (): Promise<MockApiResult> => Promise.resolve({ ok: true, data: undefined }),
  ),
  reorderAnnotation: mock((): Promise<MockApiResult> => Promise.resolve({ ok: true, data: undefined })),
  pasteAnnotations: mock((): Promise<MockApiResult> => Promise.resolve({ ok: true, data: undefined })),
};
void mock.module('src/apis/backendApi', () => ({ useBackendApi: () => apiMock }));

const { useAnnotationActions } = await import('../useAnnotationActions');
const { useGroupStore } = await import('src/stores/groupStore');

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
    const deferred = createDeferred<
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
