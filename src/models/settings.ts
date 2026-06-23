import z from 'zod';

// TODO: 本当は設定に起因する要素のため、importはしたくない & docPage.tsはフロントエンドのみの情報が多いため削除したい
import { AnnotationTool } from './docPage';

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
