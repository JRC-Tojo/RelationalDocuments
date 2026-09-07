/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import { defineStore, acceptHMRUpdate } from 'pinia';
import { useBackendApi } from 'src/apis/backendApi';
import type { ContainerElementFile, ContainerID } from 'src/models/container';
import type { AnnotationID } from 'src/models/document/pdf';
import type { AnnotationGroup, AnnotationGroupID } from 'src/models/document/group';
import { fileKey } from 'src/utils/document/fileKey';

export { fileKey };

export const useGroupStore = defineStore('annotationGroup', {
  state: () => ({
    // ファイル単位で読み込んだグループ一覧
    groupsByFileKey: {} as Record<string, AnnotationGroup[]>,
  }),

  getters: {
    /**
     * 指定IDが所属するグループを探す（グループ自身のID・メンバーのIDのどちらからでも解決できる）
     *
     * state.groupsByFileKeyへの依存はこのgetter自身の評価時点で読み取っておく
     * （返り値の関数の中で読むと、Piniaのgetterの依存追跡が曖昧になるため）
     */
    groupContaining(
      state,
    ): (fk: string, id: AnnotationID | AnnotationGroupID) => AnnotationGroup | undefined {
      return (fk, id) => {
        const groups = state.groupsByFileKey[fk] ?? [];
        return groups.find((g) => g.id === id || g.memberIds.includes(id as AnnotationID));
      };
    },

    /**
     * 指定IDが属するグループの全メンバーID集合を返す（属していない場合はundefined）
     *
     * クリック・矩形選択で選ばれたIDを、グループ全体の選択へ展開するために使う
     */
    memberSet(): (
      fk: string,
      id: AnnotationID | AnnotationGroupID,
    ) => Set<AnnotationID> | undefined {
      const getGroupContaining = this.groupContaining;
      return (fk, id) => {
        const group = getGroupContaining(fk, id);
        return group === undefined ? undefined : new Set(group.memberIds);
      };
    },

    /**
     * 指定したID集合が、既存グループの全メンバーとちょうど一致するグループを返す
     * （部分一致・過不足がある場合はundefined）
     *
     * 「選択範囲がまるごと1つのグループかどうか」の判定（グループ化解除メニューの表示可否、
     * 関係性ダイアログをグループ単位で開くかどうかの判定）に使う
     */
    matchingGroup(state): (fk: string, ids: AnnotationID[]) => AnnotationGroup | undefined {
      return (fk, ids) => {
        if (ids.length < 2) return undefined;
        const idSet = new Set(ids);
        const groups = state.groupsByFileKey[fk] ?? [];
        return groups.find(
          (g) => g.memberIds.length === idSet.size && g.memberIds.every((id) => idSet.has(id)),
        );
      };
    },
  },

  actions: {
    /**
     * 指定ファイルのグループ一覧を読み込み、キャッシュを更新する
     *
     * `.kcfg`・文書本体のハッシュ再計算を伴う重い読み込み（`loadConfig`）を経由するため、
     * グループ化・グループ解除・値算出方法変更等、結果が既知の操作の直後には使わないこと
     * （`applyGroupChanges`参照）。タブを開いた直後の初回読み込みや、外部変更を取り込む
     * 明示的な再読込など、実際に最新状態を`.kcfg`から確認する必要がある場面専用
     */
    async refreshFile(file: ContainerElementFile): Promise<void> {
      const api = useBackendApi();
      const res = await api.listAnnotationGroups(file);
      if (!res.ok) return;

      this.groupsByFileKey[fileKey(file)] = res.data;
    },

    /**
     * 指定ファイルのグループ一覧へ、削除対象・追加/更新対象をまとめてローカル反映する
     *
     * グループ化・グループ解除・値算出方法変更等のAPI呼び出しは、結果として確定した
     * グループの内容（新規/更新後のグループ、解散されたグループのID等）をその場で返す。
     * `.kcfg`を実際に読み直す`refreshFile`（PDF本体のハッシュ再計算を伴う重い処理）を
     * 呼ばずに、既に判明しているこの結果を直接キャッシュへ適用することで、
     * 永続化の完了直後にグループとして即座に操作できるようにする（Issue #109）
     */
    applyGroupChanges(
      file: ContainerElementFile,
      changes: { removeIds?: AnnotationGroupID[]; upsert?: AnnotationGroup[] },
    ): void {
      const fk = fileKey(file);
      const removeSet = new Set(changes.removeIds ?? []);
      const upserted = changes.upsert ?? [];
      const upsertIds = new Set(upserted.map((g) => g.id));
      const current = this.groupsByFileKey[fk] ?? [];
      const kept = current.filter((g) => !removeSet.has(g.id) && !upsertIds.has(g.id));
      this.groupsByFileKey[fk] = [...kept, ...upserted];
    },

    /**
     * リネーム・移動されたファイルのキャッシュキーを付け替える
     */
    remapFileKeys(containerID: ContainerID, pathMap: Record<string, string>): void {
      const updated: Record<string, AnnotationGroup[]> = {};
      for (const [key, groups] of Object.entries(this.groupsByFileKey)) {
        const [cID, path] = key.split('|');
        if (cID === containerID && path !== undefined && pathMap[path] !== undefined) {
          updated[`${cID}|${pathMap[path]}`] = groups;
        } else {
          updated[key] = groups;
        }
      }
      this.groupsByFileKey = updated;
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useGroupStore, import.meta.hot));
}
