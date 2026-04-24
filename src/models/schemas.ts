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
  annotationIds: z.array(UUIDSchema).optional().default([]),
});

export type DocumentMetadata = z.infer<typeof DocumentMetadataSchema>;

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
const AnnotationBaseSchema = z.object({
  id: UUIDSchema,
  documentId: UUIDSchema,
  pageNumber: z.number().int().positive(),
  x: z.number(),
  y: z.number(),
  color: z.string(), // 16進カラーコード
  strokeWidth: z.number().optional().default(2),
  opacity: z.number().min(0).max(1).optional(),
  content: z.string().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  linkedAnnotationIds: z.array(UUIDSchema).optional().default([]),
  tags: z.array(z.string()).optional().default([]),
  relatedDocumentIds: z.array(UUIDSchema).optional().default([]),
});

export const AnnotationSchema = z.discriminatedUnion('type', [
  AnnotationBaseSchema.extend({
    type: z.literal('highlight'),
    width: z.number().nonnegative(),
    height: z.number().nonnegative(),
  }),
  AnnotationBaseSchema.extend({
    type: z.literal('box'),
    width: z.number().nonnegative(),
    height: z.number().nonnegative(),
  }),
  AnnotationBaseSchema.extend({
    type: z.literal('circle'),
    radius: z.number().positive(),
  }),
  AnnotationBaseSchema.extend({
    type: z.literal('line'),
    x2: z.number(),
    y2: z.number(),
    points: z.array(z.number()).length(4),
  }),
]);

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
