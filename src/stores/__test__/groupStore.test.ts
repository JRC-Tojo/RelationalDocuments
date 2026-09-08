import { describe, expect, it, beforeEach, mock } from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';
import type { ContainerElementFile, ContainerID } from 'src/models/container';
import type { AnnotationID } from 'src/models/document/pdf';
import type { AnnotationGroup, AnnotationGroupID } from 'src/models/document/group';

/**
 * `refreshFile`（`.kcfg`からの重い再読込）と`applyGroupChanges`（グループ化操作等の
 * 確定結果の即時反映、Issue #109）の競合を検証する。
 *
 * マウント時に発行される`refreshFile`（fire-and-forget）が、グループ化直後の
 * `applyGroupChanges`より後から解決すると、キャッシュが読み込み開始時点のより古い内容で
 * 丸ごと上書きされ、直後に作ったグループが一瞬（または次の明示的リロードまで）消えてしまう
 * 不具合の回帰確認（レビュー指摘#3）。
 *
 * `groupStore.ts`は`useBackendApi`（PDF描画等ブラウザAPI依存を含む巨大なファサード）を
 * 静的importしているため、`listAnnotationGroups`のみモック化する
 */
type MockApiResult<T> = { ok: true; data: T } | { ok: false; error: unknown };

/** 手動で解決タイミングを制御できるPromiseを組み立てる（`.kcfg`再読込が遅いモックの代わりに使う） */
function createDeferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const apiMock = {
  listAnnotationGroups: mock((): Promise<MockApiResult<AnnotationGroup[]>> =>
    Promise.resolve({ ok: true, data: [] }),
  ),
};
void mock.module('src/apis/backendApi', () => ({ useBackendApi: () => apiMock }));

const { useGroupStore, fileKey } = await import('../groupStore');

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
const key = fileKey(file);

const idA = '00000000-0000-4000-8000-000000000001' as AnnotationID;
const idB = '00000000-0000-4000-8000-000000000002' as AnnotationID;
const groupId = '00000000-0000-4000-8000-0000000000aa' as AnnotationGroupID;

function buildGroup(): AnnotationGroup {
  const now = '2026-01-01T00:00:00.000Z';
  return { id: groupId, memberIds: [idA, idB], createdAt: now, updatedAt: now };
}

beforeEach(() => {
  setActivePinia(createPinia());
  apiMock.listAnnotationGroups.mockClear();
});

describe('refreshFileとapplyGroupChangesの競合防止（レビュー指摘#3の回帰確認）', () => {
  it('refreshFile実行中にapplyGroupChangesが割り込んだ場合、refreshFileの（読み込み開始時点でより古い）結果は棄却される', async () => {
    const groupStore = useGroupStore();

    // マウント時のrefreshFile（fire-and-forget）が発行されたが、まだ解決していない状態を模す
    const deferred = createDeferred<MockApiResult<AnnotationGroup[]>>();
    apiMock.listAnnotationGroups.mockImplementationOnce(() => deferred.promise);
    const refreshPromise = groupStore.refreshFile(file);

    // refreshFileの完了を待たずに、グループ化操作の確定結果が直接反映される
    // （groupStore.applyGroupChanges、Issue #109）
    const newGroup = buildGroup();
    groupStore.applyGroupChanges(file, { upsert: [newGroup] });
    expect(groupStore.matchingGroup(key, [idA, idB])?.id).toBe(groupId);

    // その後、読み込み開始時点ではまだグループが存在しなかった内容でrefreshFileが解決する
    deferred.resolve({ ok: true, data: [] });
    await refreshPromise;

    // 読み込み開始時点より後にapplyGroupChangesが実行されているため、refreshFileの結果は
    // 棄却され、直後に作ったグループが消えないこと
    expect(groupStore.matchingGroup(key, [idA, idB])?.id).toBe(groupId);
  });

  it('割り込みが無ければ、refreshFileの結果は通常通り反映される', async () => {
    const groupStore = useGroupStore();
    const newGroup = buildGroup();
    apiMock.listAnnotationGroups.mockImplementationOnce(() =>
      Promise.resolve({ ok: true, data: [newGroup] }),
    );

    await groupStore.refreshFile(file);

    expect(groupStore.groupsByFileKey[key]).toEqual([newGroup]);
  });
});
