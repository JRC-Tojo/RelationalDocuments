import { describe, expect, it, beforeEach, mock } from 'bun:test';
import { createPinia, setActivePinia } from 'pinia';
import type { AnnotationID } from 'src/models/document/pdf';
import type { AnnotationGroup, AnnotationGroupID } from 'src/models/document/group';
import type { ContainerElementFile, ContainerID } from 'src/models/container';

/**
 * `groupStore.ts`は`useBackendApi`（`src/apis/backendApi.ts`）を静的importしており、
 * これは全サービスを束ねる巨大なファサードのため、実体のまま読み込むとBunのテスト環境では
 * DOMMatrix等のブラウザAPI依存で失敗する（`relationalStore.test.ts`と同じ理由）。
 * `refreshFile`のみが`useBackendApi`を使うため、`listAnnotationGroups`のみモック化する
 */
const apiMock = {
  listAnnotationGroups: mock((): Promise<{ ok: true; data: AnnotationGroup[] }> =>
    Promise.resolve({ ok: true, data: [] }),
  ),
};
void mock.module('src/apis/backendApi', () => ({ useBackendApi: () => apiMock }));

const { useGroupStore } = await import('../groupStore');

const containerA = '00000000-0000-4000-8000-0000000000c1' as ContainerID;
const containerB = '00000000-0000-4000-8000-0000000000c2' as ContainerID;
const idA = '00000000-0000-4000-8000-000000000001' as AnnotationID;
const idB = '00000000-0000-4000-8000-000000000002' as AnnotationID;
const idC = '00000000-0000-4000-8000-000000000003' as AnnotationID;
const groupId = '00000000-0000-4000-8000-0000000000aa' as AnnotationGroupID;

function buildFile(containerID: ContainerID, path: string): ContainerElementFile {
  return {
    containerID,
    type: 'File',
    path,
    createdAt: new Date(),
    updatedAt: new Date(),
    description: '',
    genre: '',
    tags: [],
  };
}

function buildGroup(memberIds: AnnotationID[]): AnnotationGroup {
  return {
    id: groupId,
    memberIds,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('groupStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    apiMock.listAnnotationGroups.mockClear();
  });

  describe('groupContaining', () => {
    it('グループ自身のIDから該当グループを見つける', () => {
      const store = useGroupStore();
      const group = buildGroup([idA, idB]);
      store.groupsByFileKey[`${containerA}|/doc.pdf`] = [group];

      expect(store.groupContaining(`${containerA}|/doc.pdf`, groupId)).toEqual(group);
    });

    it('メンバーのIDから該当グループを見つける', () => {
      const store = useGroupStore();
      const group = buildGroup([idA, idB]);
      store.groupsByFileKey[`${containerA}|/doc.pdf`] = [group];

      expect(store.groupContaining(`${containerA}|/doc.pdf`, idB)).toEqual(group);
    });

    it('該当ファイルにグループが無ければundefinedを返す', () => {
      const store = useGroupStore();
      expect(store.groupContaining(`${containerA}|/doc.pdf`, idA)).toBeUndefined();
    });

    it('IDがどのグループにも属さなければundefinedを返す', () => {
      const store = useGroupStore();
      store.groupsByFileKey[`${containerA}|/doc.pdf`] = [buildGroup([idA, idB])];

      expect(store.groupContaining(`${containerA}|/doc.pdf`, idC)).toBeUndefined();
    });
  });

  describe('memberSet', () => {
    it('該当グループの全メンバーIDをSetで返す', () => {
      const store = useGroupStore();
      store.groupsByFileKey[`${containerA}|/doc.pdf`] = [buildGroup([idA, idB])];

      expect(store.memberSet(`${containerA}|/doc.pdf`, idA)).toEqual(new Set([idA, idB]));
    });

    it('該当グループが無ければundefinedを返す', () => {
      const store = useGroupStore();
      expect(store.memberSet(`${containerA}|/doc.pdf`, idA)).toBeUndefined();
    });
  });

  describe('matchingGroup', () => {
    it('渡したID集合が既存グループの全メンバーとちょうど一致すれば、そのグループを返す', () => {
      const store = useGroupStore();
      const group = buildGroup([idA, idB]);
      store.groupsByFileKey[`${containerA}|/doc.pdf`] = [group];

      expect(store.matchingGroup(`${containerA}|/doc.pdf`, [idB, idA])).toEqual(group);
    });

    it('過不足がある場合はundefinedを返す（部分一致）', () => {
      const store = useGroupStore();
      store.groupsByFileKey[`${containerA}|/doc.pdf`] = [buildGroup([idA, idB])];

      expect(store.matchingGroup(`${containerA}|/doc.pdf`, [idA, idB, idC])).toBeUndefined();
    });

    it('IDが1件以下の場合は判定せずundefinedを返す', () => {
      const store = useGroupStore();
      store.groupsByFileKey[`${containerA}|/doc.pdf`] = [buildGroup([idA, idB])];

      expect(store.matchingGroup(`${containerA}|/doc.pdf`, [idA])).toBeUndefined();
    });
  });

  describe('refreshFile', () => {
    it('APIから取得したグループ一覧でキャッシュを更新する', async () => {
      const store = useGroupStore();
      const group = buildGroup([idA, idB]);
      apiMock.listAnnotationGroups.mockResolvedValueOnce({ ok: true, data: [group] });

      const file = buildFile(containerA, '/doc.pdf');
      await store.refreshFile(file);

      expect(store.groupsByFileKey[`${containerA}|/doc.pdf`]).toEqual([group]);
    });

    it('APIが失敗を返した場合はキャッシュを更新しない', async () => {
      const store = useGroupStore();
      const key = `${containerA}|/doc.pdf`;
      store.groupsByFileKey[key] = [buildGroup([idA, idB])];
      apiMock.listAnnotationGroups.mockResolvedValueOnce({
        ok: false,
      } as unknown as { ok: true; data: AnnotationGroup[] });

      await store.refreshFile(buildFile(containerA, '/doc.pdf'));

      expect(store.groupsByFileKey[key]).toHaveLength(1);
    });
  });

  describe('remapFileKeys', () => {
    it('対象コンテナ内の、pathMapに含まれるキーだけを付け替える', () => {
      const store = useGroupStore();
      const groupOld = buildGroup([idA, idB]);
      const groupOther = buildGroup([idA, idC]);
      store.groupsByFileKey[`${containerA}|/old.pdf`] = [groupOld];
      store.groupsByFileKey[`${containerA}|/untouched.pdf`] = [groupOther];

      store.remapFileKeys(containerA, { '/old.pdf': '/new.pdf' });

      expect(store.groupsByFileKey[`${containerA}|/new.pdf`]).toEqual([groupOld]);
      expect(store.groupsByFileKey[`${containerA}|/old.pdf`]).toBeUndefined();
      expect(store.groupsByFileKey[`${containerA}|/untouched.pdf`]).toEqual([groupOther]);
    });

    it('別コンテナのキーは触らない', () => {
      const store = useGroupStore();
      const group = buildGroup([idA, idB]);
      store.groupsByFileKey[`${containerB}|/old.pdf`] = [group];

      store.remapFileKeys(containerA, { '/old.pdf': '/new.pdf' });

      expect(store.groupsByFileKey[`${containerB}|/old.pdf`]).toEqual([group]);
      expect(store.groupsByFileKey[`${containerB}|/new.pdf`]).toBeUndefined();
    });
  });
});
