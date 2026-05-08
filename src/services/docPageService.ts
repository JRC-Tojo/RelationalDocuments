import type { IDocTool, AnnotationPreset } from '../models/docPage';

/**
 * 文書ページの状態を管理して必要な機能を提供するサービス
 */
export class DocPageService {
  private pointStatus: 'hand' | 'select' = 'hand';
  private annotationPresets: Map<string, AnnotationPreset> = new Map();
  private mainTools: IDocTool[] = [];
  private subTools: IDocTool[] = [];

  constructor() {
    this.initializeDefaultPresets();
    this.initializeMainTools();
  }

  /**
   * デフォルトのアノテーションプリセットを初期化
   */
  private initializeDefaultPresets(): void {
    const defaultPresets: Array<{ id: string; name: string; preset: AnnotationPreset }> = [
      {
        id: 'line-solid-black',
        name: '実線（黒）',
        preset: {
          id: 'line-solid-black',
          name: '実線（黒）',
          type: 'line',
          style: {
            color: '#000000',
            strokeWidth: 2,
            strokeType: 'solid',
            opacity: 1,
          },
        },
      },
      {
        id: 'line-solid-red',
        name: '実線（赤）',
        preset: {
          id: 'line-solid-red',
          name: '実線（赤）',
          type: 'line',
          style: {
            color: '#FF0000',
            strokeWidth: 2,
            strokeType: 'solid',
            opacity: 1,
          },
        },
      },
      {
        id: 'box-frame-blue',
        name: 'ボックス（青枠）',
        preset: {
          id: 'box-frame-blue',
          name: 'ボックス（青枠）',
          type: 'box',
          style: {
            color: '#0000FF',
            strokeWidth: 2,
            strokeType: 'solid',
            fillColor: 'rgba(0, 0, 255, 0.1)',
            fillPattern: 'none',
            opacity: 1,
          },
        },
      },
      {
        id: 'circle-frame-green',
        name: '円（緑枠）',
        preset: {
          id: 'circle-frame-green',
          name: '円（緑枠）',
          type: 'circle',
          style: {
            color: '#00AA00',
            strokeWidth: 2,
            strokeType: 'solid',
            fillColor: 'rgba(0, 170, 0, 0.1)',
            fillPattern: 'none',
            opacity: 1,
          },
        },
      },
    ];

    defaultPresets.forEach(({ id, preset }) => {
      this.annotationPresets.set(id, preset);
    });
  }

  /**
   * メインツール群を初期化
   */
  private initializeMainTools(): void {
    this.mainTools = [
      {
        id: 'toggle-left-drawer',
        icon: 'menu',
        label: 'Left Drawer',
        action: 'toggle',
        tooltip: 'ドキュメント情報を表示/非表示',
      },
      {
        id: 'hand-mode',
        icon: 'pan_tool',
        label: 'Hand Mode',
        action: 'toggle',
        tooltip: 'ハンドツール',
      },
      {
        id: 'select-mode',
        icon: 'touch_app',
        label: 'Select Mode',
        action: 'toggle',
        tooltip: 'ポインタモード',
      },
      {
        id: 'annotation-line',
        icon: 'edit',
        label: 'Line Annotation',
        action: 'menu',
        subTools: [
          {
            id: 'line-preset-1',
            icon: 'line_style',
            label: '実線（黒）',
            action: 'direct',
            tooltip: '黒い実線を描画',
          },
          {
            id: 'line-preset-2',
            icon: 'line_style',
            label: '実線（赤）',
            action: 'direct',
            tooltip: '赤い実線を描画',
          },
        ],
        tooltip: '線を描画',
      },
      {
        id: 'annotation-box',
        icon: 'crop_square',
        label: 'Box Annotation',
        action: 'menu',
        subTools: [
          {
            id: 'box-preset-1',
            icon: 'crop_square',
            label: 'ボックス（青枠）',
            action: 'direct',
            tooltip: '青い枠のボックスを描画',
          },
        ],
        tooltip: 'ボックスを描画',
      },
      {
        id: 'annotation-circle',
        icon: 'circle_outline',
        label: 'Circle Annotation',
        action: 'menu',
        subTools: [
          {
            id: 'circle-preset-1',
            icon: 'circle_outline',
            label: '円（緑枠）',
            action: 'direct',
            tooltip: '緑い枠の円を描画',
          },
        ],
        tooltip: '円を描画',
      },
      {
        id: 'toggle-annotation-visibility',
        icon: 'visibility',
        label: 'Toggle Annotations',
        action: 'toggle',
        tooltip: 'アノテーション表示/非表示',
      },
      {
        id: 'save-menu',
        icon: 'save',
        label: 'Save Menu',
        action: 'menu',
        subTools: [
          {
            id: 'save-overwrite',
            icon: 'save',
            label: '上書き保存',
            action: 'direct',
          },
          {
            id: 'save-as',
            icon: 'save_as',
            label: '名前を付けて保存',
            action: 'direct',
          },
          {
            id: 'auto-save-toggle',
            icon: 'backup',
            label: '自動保存',
            action: 'toggle',
          },
        ],
        tooltip: 'ドキュメントを保存',
      },
      {
        id: 'print',
        icon: 'print',
        label: 'Print',
        action: 'direct',
        tooltip: 'ドキュメントを印刷',
      },
      {
        id: 'download',
        icon: 'download',
        label: 'Download',
        action: 'direct',
        tooltip: 'ドキュメントをダウンロード',
      },
      {
        id: 'toggle-right-drawer',
        icon: 'info',
        label: 'Right Drawer',
        action: 'toggle',
        tooltip: 'プロパティパネルを表示/非表示',
      },
    ];
  }

  /**
   * メインツール群を取得
   */
  getMainTools(): IDocTool[] {
    return this.mainTools;
  }

  /**
   * サブツール群を取得
   */
  getSubTools(): IDocTool[] {
    return this.subTools;
  }

  /**
   * アノテーションプリセット一覧を取得
   */
  getAnnotationPresets(): AnnotationPreset[] {
    return Array.from(this.annotationPresets.values());
  }

  /**
   * 特定のアノテーションプリセットを取得
   */
  getAnnotationPreset(presetId: string): AnnotationPreset | undefined {
    return this.annotationPresets.get(presetId);
  }

  /**
   * アノテーションプリセットを追加
   */
  addAnnotationPreset(preset: AnnotationPreset): void {
    this.annotationPresets.set(preset.id, preset);
  }

  /**
   * ツールがクリックされた時の処理
   */
  handleToolClick(toolId: string): void {
    switch (toolId) {
      case 'hand-mode':
        this.pointStatus = 'hand';
        break;
      case 'select-mode':
        this.pointStatus = 'select';
        break;
      // その他のツール処理は個別に実装
    }
  }
}

export const docPageService = new DocPageService();
