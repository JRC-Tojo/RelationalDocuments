import { z } from 'zod';
import { AnnotationTool } from './docPage';

/**
 * UUID型定義
 */
export const UUIDSchema = z.string().uuid();

export const DocumentId = z.uuidv4().brand('documentId');
export type DocumentId = z.infer<typeof DocumentId>;

/**
 * 文書メタデータスキーマ
 */
export const DocumentMetadataSchema = z.object({
  id: DocumentId,
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
  documentIds: z.array(DocumentId).optional().default([]),
  subFolderIds: z.array(UUIDSchema).optional().default([]),
  createdAt: z.date(),
});

export type DocumentFolder = z.infer<typeof DocumentFolderSchema>;

/**
 * アプリケーション設定スキーマ
 */
export const AppSettings = z.object({
  storagePath: z.string().optional(),
  cloudProvider: z.enum(['local', 'box', 'sharepoint']).optional(),
  darkMode: z.boolean().default(false),
  viewMode: z.enum(['rich', 'list1', 'list2']).default('rich'),
  sortBy: z.enum(['name', 'updatedAt', 'genre']).default('updatedAt'),
  initialized: z.boolean().default(false),
  tools: z
    .object({
      annotations: AnnotationTool.array(),
    })
    .default({ annotations: [] }),
});

export type AppSettings = z.infer<typeof AppSettings>;

/**
 * アノテーションスキーマ
 */
const AnnotationBaseSchema = z.object({
  id: UUIDSchema,
  documentId: DocumentId,
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
  relatedDocumentIds: z.array(DocumentId).optional().default([]),
});

export const AnnotationSchema = z.discriminatedUnion('type', [
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
