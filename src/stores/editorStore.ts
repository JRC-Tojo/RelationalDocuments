import { defineStore, acceptHMRUpdate } from 'pinia';
import type { DocumentTab, IDocTool } from 'src/models/docPage';
import type { AnnotationType, DocumentId } from 'src/models/schemas';

export type PointerType = AnnotationType | 'hand' | 'pointer';
export type Layouts<T> = { ul: T; ur: T; ll: T; lr: T };
export type LayoutSide = keyof Layouts<never>;

export const useEditorStore = defineStore('editor', {
  state: () => ({
    mainTools: [] as IDocTool[],
    subTools: [] as IDocTool[],
    currentTools: 'hand' as PointerType,

    // ドキュメントレイアウトの状態
    tabs: { ul: [], ur: [], ll: [], lr: [] } as Layouts<DocumentTab[]>,
    activeTabs: { ul: null, ur: null, ll: null, lr: null } as Layouts<DocumentId | null>,
    activeSide: 'ul' as LayoutSide,

    // アノテーションの表示状態
    visibleAnnotations: true,

    // TODO: タイルモードに対応
    tileMode: 'none' as string,
  }),

  actions: {
    /**
     * ストアの初期化
     */
    initStore(mainTools: IDocTool[], currentTools: PointerType = 'hand'): void {
      this.mainTools = mainTools;
      this.currentTools = currentTools;
    },

    /**
     * アクティブなタブを取得
     */
    getActiveTab(side: LayoutSide): DocumentTab | null {
      if (!this.activeTabs[side]) return null;
      return this.tabs[side].find((tab) => tab.documentId === this.activeTabs[side]) ?? null;
    },

    openTab(docId: DocumentId, docTitle: string): void {
      this.tabs[this.activeSide].push({
        documentId: docId,
        title: docTitle,
        isPinned: false,
      });
      this.activeTabs[this.activeSide] = docId;
    },

    /**
     * タブを閉じる
     */
    closeTab(docId: DocumentId): void {
      Object.entries(this.tabs).forEach(([side, tabs]) => {
        const index = tabs.findIndex((tab) => tab.documentId === docId);

        if (index !== -1) {
          const typedSide = side as LayoutSide;
          this.tabs[typedSide].splice(index, 1);

          // アクティブなタブが削除された場合は直前のタブをアクティブに
          if (this.activeTabs[typedSide] === docId) {
            const nextTabIdx = Math.max(0, index - 1);
            this.activeTabs[typedSide] = this.tabs[typedSide][nextTabIdx]
              ? this.tabs[typedSide][nextTabIdx].documentId
              : null;
          }
        }
      });
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

    /**
     * ポインタに関連するツールの定義
     */
    handleAnnotationToolClick(toolid: string) {
      switch (toolid) {
        case 'hand-mode':
          this.currentTools = 'hand';
          break;
        case 'select-mode':
          this.currentTools = 'pointer';
          break;
        case 'annotation-line':
          this.currentTools = 'line';
          break;
        case 'annotation-box':
          this.currentTools = 'box';
          break;
        case 'annotation-circle':
          this.currentTools = 'circle';
          break;
        case 'toggle-annotation-visibility':
          this.visibleAnnotations = !this.visibleAnnotations;
          break;
      }
    },
  },
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useEditorStore, import.meta.hot));
}
