import z from 'zod';
import { RelationalID } from './relational';
import { ImageURI } from '../common';

export const AnnotationID = z.uuidv4().brand('AnnotationID');
export type AnnotationID = z.infer<typeof AnnotationID>;

/**
 * アノテーションスキーマ
 */
const AnnotationBase = z.object({
  id: AnnotationID,
  pageNumber: z.number().int().positive(),
  x: z.number(),
  y: z.number(),
  color: z.string(), // 16進カラーコード
  strokeWidth: z.number().optional().default(2),
  opacity: z.number().min(0).max(1).optional(),
  content: z.string().optional(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  comment: z
    .object({
      chat: z.unknown().optional(), // TODO: チャットの形式は要検討
      relationalID: RelationalID.optional(),
    })
    .default({}),
});

/**
 * アノテーション本体の情報
 */
export const AnnotationStyle = z.discriminatedUnion('type', [
  AnnotationBase.extend({
    type: z.literal('box'),
    width: z.number().nonnegative(),
    height: z.number().nonnegative(),
  }),
  AnnotationBase.extend({
    type: z.literal('circle'),
    radius: z.number().positive(),
  }),
  AnnotationBase.extend({
    type: z.literal('line'),
    x2: z.number(),
    y2: z.number(),
    points: z.array(z.number()).length(4),
  }),
]);
export type AnnotationStyle = z.infer<typeof AnnotationStyle>;

/**
 * アノテーション位置におけるPDF本体の情報
 */
export const AnnotationContext = z.object({
  img: ImageURI,
  text: z.string(),
});
export type AnnotationContext = z.infer<typeof AnnotationContext>;
