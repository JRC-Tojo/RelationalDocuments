import { z } from 'zod';

/**
 * UUID型定義
 */
export const UUIDSchema = z.string().uuid();

/**
 * 文書メタデータスキーマ
 */
export const DocumentMetadataSchema = z.object({
  id: UUIDSchema,
  title: z.string().min(1),
  filePath: z.string(),
  fileName: z.string(),
  pageCount: z.number().int().positive(),
  fileSize: z.number().int().positive(),
  mimeType: z.string(),
  uploadedAt: z.date(),
  updatedAt: z.date(),
  lastViewedAt: z.date().optional(),
  description: z.string().optional().default(''),
  genre: z.string().optional().default(''),
  tags: z.array(z.string()).optional().default([]),
  markupIds: z.array(UUIDSchema).optional().default([]),
});

export type DocumentMetadata = z.infer<typeof DocumentMetadataSchema>;

/**
 * 文書改訂履歴スキーマ
 */
export const DocumentRevisionSchema = z.object({
  id: UUIDSchema,
  documentId: UUIDSchema,
  revisionNumber: z.number().int().positive(),
  changedAt: z.date(),
  changeDescription: z.string().optional(),
  changedPages: z.array(z.number().int().positive()).optional().default([]),
  previousVersionId: UUIDSchema.optional(),
});

export type DocumentRevision = z.infer<typeof DocumentRevisionSchema>;

/**
 * マークアップブロック（改訂履歴単位）スキーマ
 */
export const MarkupBlockSchema = z.object({
  id: UUIDSchema,
  markupId: UUIDSchema,
  title: z.string().min(1),
  content: z.string(),
  genre: z.string().optional(),
  revisionIds: z.array(UUIDSchema).optional().default([]),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type MarkupBlock = z.infer<typeof MarkupBlockSchema>;

/**
 * 整合性チェックルールスキーマ
 */
export const ComplianceRuleSchema = z.object({
  id: UUIDSchema,
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.enum(['exact_match', 'formula', 'condition_check']),
  sourceMarkupIds: z.array(UUIDSchema),
  targetMarkupId: UUIDSchema,
  ruleExpression: z.string(), // formula or condition expression
  createdAt: z.date(),
});

export type ComplianceRule = z.infer<typeof ComplianceRuleSchema>;

/**
 * フォルダ構造スキーマ
 */
export const DocumentFolderSchema = z.object({
  id: UUIDSchema,
  name: z.string().min(1),
  parentId: UUIDSchema.optional(),
  documentIds: z.array(UUIDSchema).optional().default([]),
  subFolderIds: z.array(UUIDSchema).optional().default([]),
  createdAt: z.date(),
});

export type DocumentFolder = z.infer<typeof DocumentFolderSchema>;

/**
 * アプリケーション設定スキーマ
 */
export const AppSettingsSchema = z.object({
  storagePath: z.string().optional(),
  cloudProvider: z.enum(['local', 'box', 'sharepoint']).optional(),
  darkMode: z.boolean().optional().default(false),
  viewMode: z.enum(['rich', 'list1', 'list2']).optional().default('rich'),
  sortBy: z.enum(['name', 'updatedAt', 'genre']).optional().default('updatedAt'),
  initialized: z.boolean().optional().default(false),
});

export type AppSettings = z.infer<typeof AppSettingsSchema>;

/**
 * アノテーション型定義（Konva用）
 */
export const AnnotationTypeSchema = z.enum(['highlight', 'line', 'box', 'circle']);
export type AnnotationType = z.infer<typeof AnnotationTypeSchema>;

/**
 * アノテーションスキーマ
 */
export const AnnotationSchema = z.object({
  id: UUIDSchema,
  documentId: UUIDSchema,
  pageNumber: z.number().int().positive(),
  type: AnnotationTypeSchema,
  x: z.number(),
  y: z.number(),
  width: z.number().optional(),
  height: z.number().optional(),
  x2: z.number().optional(), // 線の終点X座標
  y2: z.number().optional(), // 線の終点Y座標
  radius: z.number().optional(), // 円の半径
  points: z.array(z.number()).optional(), // 汎用座標配列
  color: z.string(), // hex color code
  strokeWidth: z.number().optional().default(2),
  opacity: z.number().min(0).max(1).optional(),
  content: z.string().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
  linkedMarkupIds: z.array(UUIDSchema).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  relatedDocumentIds: z.array(UUIDSchema).optional().default([]),
});

export type Annotation = z.infer<typeof AnnotationSchema>;

/**
 * API レスポンススキーマ（汎用）
 */
export const ApiResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  timestamp: z.date(),
});

export type ApiResponse<T = unknown> = z.infer<typeof ApiResponseSchema> & {
  data?: T;
};
