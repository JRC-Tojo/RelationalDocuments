import type { DocumentId } from './schemas';
import z from 'zod';

/**
 * 文書ページに表示する各ツール
 */
export interface IDocTool {
  id: string;
  icon: string;
  label: string;
  onClicked: () => void;
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
export const AnnotationLineStyle = z.object({
  type: z.literal('line'),
  strokeColor: z.string(),
  strokeWidth: z.number(),
  strokeType: z.enum(['solid', 'dashed', 'dotted', 'dash-dot', 'double']),
  strokeOpacity: z.number(),
});
export const AnnotationBoxStyle = z.object({
  type: z.literal('box'),
  strokeColor: z.string(),
  strokeWidth: z.number(),
  strokeType: z.enum(['solid', 'dashed', 'dotted', 'dash-dot', 'double']),
  strokeOpacity: z.number(),
  fillColor: z.string(),
  fillPattern: z.enum(['none', 'hatch', 'solid']),
  fillOpacity: z.number(),
});
export const AnnotationCircleStyle = z.object({
  type: z.literal('circle'),
  strokeColor: z.string(),
  strokeWidth: z.number(),
  strokeType: z.enum(['solid', 'dashed', 'dotted', 'dash-dot', 'double']),
  strokeOpacity: z.number(),
  fillColor: z.string().optional(),
  fillPattern: z.enum(['none', 'hatch', 'solid']),
  fillOpacity: z.number(),
});
export const AnnotationTextStyle = z.object({
  type: z.literal('text'),
  textColor: z.string(),
  fontWeight: z.number(),
  strokeWidth: z.number(),
  strokeType: z.enum(['solid', 'dashed', 'dotted', 'dash-dot', 'double']),
  strokeOpacity: z.number(),
  fillColor: z.string().optional(),
  fillPattern: z.enum(['none', 'hatch', 'solid']),
  fillOpacity: z.number(),
});
export const AnnotationStyle = z.discriminatedUnion('type', [
  AnnotationLineStyle,
  AnnotationBoxStyle,
  AnnotationCircleStyle,
  AnnotationTextStyle,
]);
export type AnnotationStyle = z.infer<typeof AnnotationStyle>;
export type AnnotationType = AnnotationStyle['type'];

/**
 * アノテーションプリセット
 */
export const AnnotationTool = z.object({
  id: z.string(),
  name: z.string(),
  style: AnnotationStyle,
});
export type AnnotationTool = z.infer<typeof AnnotationTool>;

/**
 * アノテーション関係性定義
 */
export interface AnnotationRelation {
  sourceAnnotationId: string;
  targetAnnotationId: string;
  relationType: 'equals' | 'references' | 'contains' | 'condition';
  condition?: string; // 数学的条件式など
}
