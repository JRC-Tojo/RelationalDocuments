import { defineStore, acceptHMRUpdate } from 'pinia';
import type { AnnotationStyle, AnnotationType, DocumentTab, IDocTool } from 'src/models/docPage';
import type { DocumentId } from 'src/models/schemas';

export type PointerType = AnnotationType | 'hand' | 'pointer';
export type Layouts<T> = { ul: T; ur: T; ll: T; lr: T };
export type LayoutSide = keyof Layouts<never>;
export type TileMode = 'single' | 'dubble' | 'grid';

/**
 * デフォルトのアノテーションスタイル
 */
const DEFAULT_ANNOTATION_STYLE: AnnotationStyle = {
  type: 'line',
  strokeColor: '#000000',
  strokeWidth: 2,
  strokeType: 'solid',
  strokeOpacity: 1,
};

export const useEditorStore = defineStore('editor', {
  state: () => ({
    mainTools: [] as IDocTool[],
    subTools: [] as IDocTool[],
    currentTools: 'hand' as PointerType,
    currentAnnotationStyle: DEFAULT_ANNOTATION_STYLE as AnnotationStyle,
    isStoreInitialized: false,

    // ドキュメントレイアウトの状態
    tabs: { ul: [], ur: [], ll: [], lr: [] } as Layouts<DocumentTab[]>,
    activeTabs: { ul: null, ur: null, ll: null, lr: null } as Layouts<DocumentId | null>,
    activeSide: 'ul' as LayoutSide,

    // アノテーションの表示状態
    visibleAnnotations: true,
    autoSaveAnnotations: false,

    // サイドパネルの表示状態
    leftDrawerModel: false,
    rightDrawerModel: false,

    // タブ表示のタイルモード
    tileMode: 'single' as TileMode,
  }),

  actions: {
    /**
     * ストアの初期化（初回のみ実行）
     */
    initStore(mainTools: IDocTool[], currentTools: PointerType = 'hand'): void {
      // 既に初期化済みの場合はスキップ
      if (this.isStoreInitialized) return;

      this.mainTools = mainTools;
      this.currentTools = currentTools;
      this.isStoreInitialized = true;
    },

    /**
     * アクティブなタブを取得
     */
    getActiveTab(side: LayoutSide): DocumentTab | null {
      if (!this.activeTabs[side]) return null;
      return this.tabs[side].find((tab) => tab.documentId === this.activeTabs[side]) ?? null;
    },

    /**
     * 選択された文書のタブを開く
     */
    openTab(docId: DocumentId, docTitle: string): void {
      if (!this.tabs[this.activeSide].find((tab) => tab.documentId === docId)) {
        this.tabs[this.activeSide].push({
          documentId: docId,
          title: docTitle,
          isPinned: false,
        });
      }
      this.selectTab(docId, this.activeSide, true);
    },

    /**
     * タブを選択する
     * @param isFocus: Trueの時にactiveSideを更新する
     */
    selectTab(docId: DocumentId, layoutSide: LayoutSide, isFocus: boolean): void {
      this.activeTabs[layoutSide] = docId;
      if (isFocus) this.activeSide = layoutSide;
    },

    /**
     * タブを閉じる
     */
    closeTab(docId: DocumentId, layoutSide: LayoutSide): void {
      const index = this.tabs[layoutSide].findIndex((tab) => tab.documentId === docId);

      if (index !== -1) {
        this.tabs[layoutSide].splice(index, 1);

        // アクティブなタブが削除された場合は直前のタブをアクティブに
        if (this.activeTabs[layoutSide] === docId) {
          const nextTabIdx = Math.max(0, index - 1);
          this.activeTabs[layoutSide] = this.tabs[layoutSide][nextTabIdx]
            ? this.tabs[layoutSide][nextTabIdx].documentId
            : null;
        }
      }
    },

    /**
     * タブをピンする
     */
    pinTab(docId: DocumentId): void {
      Object.values(this.tabs).forEach((tabs) => {
        const foundTab = tabs.find((tab) => tab.documentId === docId);
        if (foundTab) {
          foundTab.isPinned = !foundTab.isPinned;
        }
      });
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useEditorStore, import.meta.hot));
}
