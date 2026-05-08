import type { DocumentId } from "./schemas";

/**
 * ツールアクション型
 */
export type ToolAction = 'toggle' | 'menu' | 'direct';

/**
 * 文書ページに表示する各ツール
 */
export interface IDocTool {
  id: string;
  icon: string;
  label: string;
  action: ToolAction;
  onClicked?: () => void;
  subTools?: IDocTool[];
  tooltip?: string;
}

/**
 * ドキュメントタブ
 */
export interface DocumentTab {
  documentId: DocumentId;
  title: string;
  isPinned: boolean;
}

/**
 * ビューモード
 */
export type ViewMode = 'single' | 'spread' | 'continuousSingle' | 'continuousSpread';

/**
 * タイル表示モード
 */
export type TileMode = 'none' | 'vertical' | 'horizontal' | 'grid';

/**
 * アノテーション描画設定
 */
export interface AnnotationStyle {
  color: string;
  strokeWidth: number;
  strokeType: 'solid' | 'dashed' | 'dotted' | 'dash-dot' | 'double';
  fillColor?: string;
  fillPattern?: 'none' | 'hatch' | 'solid';
  opacity?: number;
}

/**
 * アノテーションプリセット
 */
export interface AnnotationPreset {
  id: string;
  name: string;
  type: 'line' | 'box' | 'circle' | 'text';
  style: AnnotationStyle;
}

/**
 * アノテーション関係性定義
 */
export interface AnnotationRelation {
  sourceAnnotationId: string;
  targetAnnotationId: string;
  relationType: 'equals' | 'references' | 'contains' | 'condition';
  condition?: string; // 数学的条件式など
}
